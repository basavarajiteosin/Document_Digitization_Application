using System.Collections.Concurrent;
using DDAAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DDAAPI.Hubs
{
    [Authorize]
    public class CollabHub : Hub
    {
        private sealed record Viewer(string UserId, string Name);
        private sealed record DocUpdate(byte[] Data, DateTime At);
        private sealed class DocState
        {
            public readonly List<DocUpdate> Updates = new();
            public long Bytes;
            public string? ClaimedBy;
            public DateTime ClaimedOn;
            public DateTime? CompactRequestedOn;
            public readonly object Gate = new();
        }

        private static readonly ConcurrentDictionary<int, ConcurrentDictionary<string, Viewer>> Rooms = new();
        // In-memory Yjs state per open file. Discarded when the last viewer leaves or the file is replaced.
        private static readonly ConcurrentDictionary<int, DocState> Docs = new();
        // Updates newer than this are kept on compaction, so nothing in flight is lost.
        private static readonly TimeSpan CompactOverlap = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan CompactRetry = TimeSpan.FromSeconds(60);

        private readonly FileVersionService _svc;
        private readonly long _maxDocBytes;
        private readonly int _compactAfterUpdates;
        private readonly TimeSpan _claimTimeout;

        public CollabHub(FileVersionService svc, IConfiguration cfg)
        {
            _svc = svc;
            _maxDocBytes = cfg.GetValue<long?>("Collab:MaxDocBytes") ?? 64L * 1024 * 1024;
            _compactAfterUpdates = cfg.GetValue<int?>("Collab:CompactAfterUpdates") ?? 2000;
            _claimTimeout = TimeSpan.FromSeconds(cfg.GetValue<int?>("Collab:ClaimTimeoutSeconds") ?? 30);
        }

        public static string Group(int fileId) => $"file-{fileId}";

        /// <summary>Drops the live co-authoring state (file replaced by an upload or restore).</summary>
        public static void ResetDocState(int fileId) => Docs.TryRemove(fileId, out _);

        public async Task<object> JoinFile(int fileId)
        {
            var (uid, name) = await _svc.GetViewerAsync(Context.User?.Identity?.Name, fileId);
            await Groups.AddToGroupAsync(Context.ConnectionId, Group(fileId));
            Rooms.GetOrAdd(fileId, _ => new())[Context.ConnectionId] = new Viewer(uid, name);
            return await Broadcast(fileId);   // the joiner also gets the list directly
        }

        public async Task LeaveFile(int fileId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, Group(fileId));
            ReleaseClaim(fileId, Context.ConnectionId);
            if (Rooms.TryGetValue(fileId, out var room))
            {
                room.TryRemove(Context.ConnectionId, out _);
                if (room.IsEmpty) { Rooms.TryRemove(fileId, out _); Docs.TryRemove(fileId, out _); }
            }
            await Broadcast(fileId);
        }

        // ---------------- co-authoring (Yjs relay) ----------------
        public async Task<object> JoinDoc(int fileId)
        {
            var emp = Context.User?.Identity?.Name;
            await _svc.GetViewerAsync(emp, fileId);                 // throws HubException without view access
            var write = await _svc.CanWriteAsync(emp, fileId);
            Context.Items[$"w{fileId}"] = write;
            await Groups.AddToGroupAsync(Context.ConnectionId, Group(fileId));

            var st = Docs.GetOrAdd(fileId, _ => new DocState());
            lock (st.Gate)
            {
                var claim = write && TryClaim(st);
                return new
                {
                    state = st.Updates.Select(u => Convert.ToBase64String(u.Data)).ToArray(),
                    canWrite = write,
                    claim,
                    seeding = !claim && st.Updates.Count == 0 && st.ClaimedBy != null
                };
            }
        }

        /// <summary>Asks to become the client that loads the file into an empty shared document.</summary>
        public bool ClaimDoc(int fileId)
        {
            if (!CanWrite(fileId)) return false;
            var st = Docs.GetOrAdd(fileId, _ => new DocState());
            lock (st.Gate) return TryClaim(st);
        }

        private bool TryClaim(DocState st)
        {
            if (st.Updates.Count > 0) return false;
            if (st.ClaimedBy != null && st.ClaimedBy != Context.ConnectionId &&
                DateTime.UtcNow - st.ClaimedOn <= _claimTimeout) return false;
            st.ClaimedBy = Context.ConnectionId;
            st.ClaimedOn = DateTime.UtcNow;
            return true;
        }

        private bool CanWrite(int fileId) =>
            Context.Items.TryGetValue($"w{fileId}", out var w) && w is true;

        public async Task SendDocUpdate(int fileId, string update)
        {
            if (!CanWrite(fileId)) throw new HubException("You have read-only access to this file.");
            var data = Decode(update);
            var st = Docs.GetOrAdd(fileId, _ => new DocState());
            var askCompact = false;
            lock (st.Gate)
            {
                if (st.Bytes + data.Length > _maxDocBytes)
                    throw new HubException("This editing session has grown too large. Save the document and reopen it.");
                st.Updates.Add(new DocUpdate(data, DateTime.UtcNow));
                st.Bytes += data.Length;
                st.ClaimedBy = null;
                var due = st.Updates.Count > _compactAfterUpdates || st.Bytes > _maxDocBytes / 4;
                if (due && (st.CompactRequestedOn == null || DateTime.UtcNow - st.CompactRequestedOn > CompactRetry))
                {
                    st.CompactRequestedOn = DateTime.UtcNow;
                    askCompact = true;
                }
            }
            await Clients.OthersInGroup(Group(fileId)).SendAsync("DocUpdate", fileId, update);
            if (askCompact) await Clients.Caller.SendAsync("DocCompactRequest", fileId);
        }

        public Task CompactDoc(int fileId, string fullState)
        {
            if (!CanWrite(fileId)) return Task.CompletedTask;
            var data = Decode(fullState);
            if (Docs.TryGetValue(fileId, out var st))
                lock (st.Gate)
                {
                    var cutoff = DateTime.UtcNow - CompactOverlap;
                    var recent = st.Updates.Where(u => u.At > cutoff).ToList();
                    st.Updates.Clear();
                    st.Updates.Add(new DocUpdate(data, DateTime.UtcNow));
                    st.Updates.AddRange(recent);              // Yjs updates are idempotent
                    st.Bytes = st.Updates.Sum(u => (long)u.Data.Length);
                    st.CompactRequestedOn = null;
                    st.ClaimedBy = null;
                }
            return Task.CompletedTask;
        }

        public Task SendAwareness(int fileId, string update)
        {
            if (!Context.Items.ContainsKey($"w{fileId}")) return Task.CompletedTask;
            return Clients.OthersInGroup(Group(fileId)).SendAsync("DocAwareness", fileId, update);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            foreach (var kv in Docs) ReleaseClaim(kv.Key, Context.ConnectionId);

            foreach (var kv in Rooms)
            {
                if (kv.Value.TryRemove(Context.ConnectionId, out _))
                {
                    if (kv.Value.IsEmpty) { Rooms.TryRemove(kv.Key, out _); Docs.TryRemove(kv.Key, out _); }
                    await Broadcast(kv.Key);
                }
            }
            await base.OnDisconnectedAsync(exception);
        }

        private static void ReleaseClaim(int fileId, string connectionId)
        {
            if (Docs.TryGetValue(fileId, out var st))
                lock (st.Gate)
                    if (st.ClaimedBy == connectionId) st.ClaimedBy = null;
        }

        private static byte[] Decode(string b64)
        {
            if (string.IsNullOrEmpty(b64)) throw new HubException("Empty document update.");
            try { return Convert.FromBase64String(b64); }
            catch (FormatException) { throw new HubException("Invalid document update."); }
        }

        private async Task<object> Broadcast(int fileId)
        {
            var users = new List<object>();
            if (Rooms.TryGetValue(fileId, out var room))
                users.AddRange(room.GroupBy(kv => kv.Value.UserId)
                    .Select(g => (object)new
                    {
                        userId = g.Key,
                        name = g.First().Value.Name,
                        connections = g.Select(kv => kv.Key).ToArray()
                    }));
            var payload = new { fileId, users };
            await Clients.Group(Group(fileId)).SendAsync("PresenceChanged", payload);
            return payload;
        }

        /// <summary>Clears stale/blank shared state so the next writer re-seeds it from the file.</summary>
        public Task ResetDoc(int fileId)
        {
            if (!CanWrite(fileId)) return Task.CompletedTask;
            if (Rooms.TryGetValue(fileId, out var room) &&
                room.Values.Select(v => v.UserId).Distinct().Count() > 1)
                return Task.CompletedTask;   // others are editing: never wipe a live session
            Docs.TryRemove(fileId, out _);
            return Task.CompletedTask;
        }
    }
}