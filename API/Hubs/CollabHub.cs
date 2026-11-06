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
        private sealed class DocState
        {
            public readonly List<byte[]> Updates = new();
            public string? ClaimedBy;
            public readonly object Gate = new();
        }

        private static readonly ConcurrentDictionary<int, ConcurrentDictionary<string, Viewer>> Rooms = new();
        // In-memory Yjs state per open file (real-time co-authoring). Discarded when the last viewer leaves.
        private static readonly ConcurrentDictionary<int, DocState> Docs = new();

        private readonly FileVersionService _svc;
        public CollabHub(FileVersionService svc) { _svc = svc; }

        public static string Group(int fileId) => $"file-{fileId}";

        public async Task JoinFile(int fileId)
        {
            var (uid, name) = await _svc.GetViewerAsync(Context.User?.Identity?.Name, fileId);
            await Groups.AddToGroupAsync(Context.ConnectionId, Group(fileId));
            Rooms.GetOrAdd(fileId, _ => new())[Context.ConnectionId] = new Viewer(uid, name);
            await Broadcast(fileId);
        }

        public async Task LeaveFile(int fileId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, Group(fileId));
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
                var claim = false;
                if (st.Updates.Count == 0 && write && st.ClaimedBy == null) { st.ClaimedBy = Context.ConnectionId; claim = true; }
                return new { state = st.Updates.Select(Convert.ToBase64String).ToArray(), canWrite = write, claim };
            }
        }

        private bool CanWrite(int fileId) =>
            Context.Items.TryGetValue($"w{fileId}", out var w) && w is true;

        public async Task SendDocUpdate(int fileId, string update)
        {
            if (!CanWrite(fileId)) throw new HubException("You have read-only access to this file.");
            var st = Docs.GetOrAdd(fileId, _ => new DocState());
            lock (st.Gate) { st.Updates.Add(Convert.FromBase64String(update)); st.ClaimedBy = null; }
            await Clients.OthersInGroup(Group(fileId)).SendAsync("DocUpdate", fileId, update);
        }

        public Task CompactDoc(int fileId, string fullState)
        {
            if (!CanWrite(fileId)) return Task.CompletedTask;
            if (Docs.TryGetValue(fileId, out var st))
                lock (st.Gate) { st.Updates.Clear(); st.Updates.Add(Convert.FromBase64String(fullState)); }
            return Task.CompletedTask;
        }

        public Task SendAwareness(int fileId, string update)
        {
            if (!Context.Items.ContainsKey($"w{fileId}")) return Task.CompletedTask;
            return Clients.OthersInGroup(Group(fileId)).SendAsync("DocAwareness", fileId, update);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            foreach (var kv in Docs)
                lock (kv.Value.Gate)
                    if (kv.Value.ClaimedBy == Context.ConnectionId && kv.Value.Updates.Count == 0) kv.Value.ClaimedBy = null;

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

        private Task Broadcast(int fileId)
        {
            var users = new List<object>();
            if (Rooms.TryGetValue(fileId, out var room))
                users.AddRange(room.Values.GroupBy(v => v.UserId)
                    .Select(g => (object)new { userId = g.Key, name = g.First().Name }));
            return Clients.Group(Group(fileId)).SendAsync("PresenceChanged", new { fileId, users });
        }
    }
}