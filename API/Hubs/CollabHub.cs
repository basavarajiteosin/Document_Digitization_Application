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

        // fileId -> (connectionId -> viewer). In-memory presence; fine for a single API instance.
        private static readonly ConcurrentDictionary<int, ConcurrentDictionary<string, Viewer>> Rooms = new();

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
                if (room.IsEmpty) Rooms.TryRemove(fileId, out _);
            }
            await Broadcast(fileId);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            foreach (var kv in Rooms)
            {
                if (kv.Value.TryRemove(Context.ConnectionId, out _))
                {
                    if (kv.Value.IsEmpty) Rooms.TryRemove(kv.Key, out _);
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