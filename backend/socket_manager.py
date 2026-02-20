import socketio
import uuid
import random
from typing import Dict, List

# Create a Socket.IO server (ASGI version)
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*"
)

# Matchmaking Queues
tictactoe_queue = []
blackjack_queue = []

# rooms = { room_id: { type: 'blackjack', players: [...], state: {...} } }
rooms = {}

def create_deck():
    deck = list(range(52))
    random.shuffle(deck)
    return deck

def calculate_score(cards):
    score = 0
    aces = 0
    for card in cards:
        val = (card % 13) + 1
        if val > 10: score += 10
        elif val == 1: 
            score += 11
            aces += 1
        else: score += val
    while score > 21 and aces > 0:
        score -= 10
        aces -= 1
    return score

@sio.event
async def connect(sid, environ, auth):
    print(f"Player Connected: {sid}")

@sio.event
async def disconnect(sid, *args):
    global tictactoe_queue, blackjack_queue
    print(f"Player Disconnected: {sid}")
    tictactoe_queue = [p for p in tictactoe_queue if p['sid'] != sid]
    blackjack_queue = [p for p in blackjack_queue if p['sid'] != sid]
    
    # Cleanup rooms
    # Create a copy of keys to iterate safely
    for rid in list(rooms.keys()):
        if rid not in rooms: continue # prevent race condition KeyErrors
        room = rooms[rid]
        players = room.get('players', [])
        current_player = next((p for p in players if p['sid'] == sid), None)
        
        if current_player:
            room['players'] = [p for p in players if p['sid'] != sid]
            await sio.emit("player_disconnected", {
                "sid": sid, 
                "username": current_player['profile'].get('username', 'Someone')
            }, room=rid)
            
            if not room['players']:
                # Double check before delete
                if rid in rooms: del rooms[rid]
            else:
                if room.get('type') == 'blackjack' and room.get('status') == 'PLAYING':
                    if room['turn_index'] >= len(room['players']):
                        await dealer_play(rid)
                    else:
                        await emit_update(rid)

    # Broadcast updated room list to everyone searching for rooms
    await broadcast_room_list()

@sio.on("request_match")
async def handle_request_match(sid, data):
    global tictactoe_queue
    profile = data.get("profile", {"username": "Anonymous", "avatar_url": ""})
    if any(p['sid'] == sid for p in tictactoe_queue): return
    if not tictactoe_queue:
        tictactoe_queue.append({"sid": sid, "profile": profile})
        await sio.emit("waiting_for_opponent", {"message": "Waiting for opponent..."}, to=sid)
    else:
        opponent = tictactoe_queue.pop(0)
        room_id = f"ttt_{uuid.uuid4().hex[:8]}"
        await sio.enter_room(sid, room_id)
        await sio.enter_room(opponent['sid'], room_id)
        
        rooms[room_id] = {
            "type": "tictactoe",
            "name": "Tic Tac Toe Arena",
            "players": [
                {"sid": sid, "profile": profile},
                {"sid": opponent['sid'], "profile": opponent['profile']}
            ],
            "status": "PLAYING"
        }
        
        await sio.emit("match_start", {"room_id": room_id, "symbol": 1, "opponent": profile}, to=opponent['sid'])
        await sio.emit("match_start", {"room_id": room_id, "symbol": 2, "opponent": opponent['profile']}, to=sid)

@sio.on("create_private_ttt")
async def handle_create_private(sid, data):
    profile = data.get("profile", {"username": "Anonymous", "avatar_url": ""})
    room_id = f"ttt_{uuid.uuid4().hex[:8]}"
    rooms[room_id] = {
        "type": "tictactoe_private",
        "players": [{"sid": sid, "profile": profile}]
    }
    await sio.enter_room(sid, room_id)
    await sio.emit("waiting_for_opponent", {"message": "Waiting for friend to join...", "room_id": room_id}, to=sid)

@sio.on("join_private_ttt")
async def handle_join_private(sid, data):
    room_id = data.get("room_id")
    profile = data.get("profile", {"username": "Anonymous", "avatar_url": ""})
    if room_id in rooms and rooms[room_id]["type"] == "tictactoe_private":
        room = rooms[room_id]
        if len(room["players"]) == 1:
            opponent = room["players"][0]
            await sio.enter_room(sid, room_id)
            room["players"].append({"sid": sid, "profile": profile})
            await sio.emit("match_start", {"room_id": room_id, "symbol": 1, "opponent": profile}, to=opponent['sid'])
            await sio.emit("match_start", {"room_id": room_id, "symbol": 2, "opponent": opponent['profile']}, to=sid)
            del rooms[room_id] # Clean up
        else:
            await sio.emit("error", {"message": "Room is full or no longer available"}, to=sid)
    else:
        await sio.emit("error", {"message": "Invalid room"}, to=sid)

# --- Blackjack Room Logic ---

@sio.on("get_rooms")
async def handle_get_rooms(sid):
    # Send available rooms to the client
    room_list = []
    for rid, r in rooms.items():
        if r.get("type") == "blackjack":
             room_list.append({
                "id": rid,
                "name": r.get('name', "Blackjack Table"),
                "players": len(r['players']),
                "max_players": 4,
                "status": r['status']
            })
    await sio.emit("room_list_update", room_list, to=sid)

async def broadcast_room_list():
    room_list = []
    for rid, r in rooms.items():
        if r.get("type") == "blackjack":
             room_list.append({
                "id": rid,
                "name": r.get('name', "Blackjack Table"),
                "players": len(r['players']),
                "max_players": 4,
                "status": r['status']
            })
    await sio.emit("room_list_update", room_list)

@sio.on("create_room")
async def handle_create_room(sid, data):
    profile = data.get("profile")
    room_name = data.get("name", "High Rollers Table")
    
    room_id = f"bj_{uuid.uuid4().hex[:8]}"
    rooms[room_id] = {
        "type": "blackjack",
        "name": room_name,
        "players": [],
        "dealer_hand": [],
        "deck": create_deck(),
        "turn_index": 0,
        "status": "BETTING"
    }
    await join_blackjack_room(sid, room_id, profile)
    await broadcast_room_list()

@sio.on("join_room")
async def handle_join_room(sid, data):
    room_id = data.get("room_id")
    profile = data.get("profile")
    if room_id in rooms:
        await join_blackjack_room(sid, room_id, profile)
        await broadcast_room_list()
    else:
        await sio.emit("error", {"message": "Table closed or invalid room link."}, to=sid)

async def join_blackjack_room(sid, room_id, profile):
    room = rooms[room_id]
    
    # Check if player already in room to prevent duplicates
    if any(p['sid'] == sid for p in room['players']):
        # Optional: Re-send match start if needed, or just return
        await sio.emit("bj_match_start", {
            "room_id": room_id, "players": [
                {"username": p['profile']['username'], "avatar_url": p['profile']['avatar_url'], "sid": p['sid']}
                for p in room['players']
            ]
        }, room=room_id, to=sid)
        return

    if len(room['players']) >= 4:
        await sio.emit("error", {"message": "Room is full"}, to=sid)
        return

    await sio.enter_room(sid, room_id)
    room['players'].append({
        "sid": sid, 
        "profile": profile, 
        "bet": 0, 
        "status": "BETTING", 
        "hands": [],
        "active_hand_index": 0
    })
    
    # Notify everyone in the room
    await sio.emit("bj_match_start", {
        "room_id": room_id, "players": [
            {"username": p['profile']['username'], "avatar_url": p['profile']['avatar_url'], "sid": p['sid']}
            for p in room['players']
        ]
    }, room=room_id)

    # Sync state for the new joiner if game is in progress (observer mode essentially until next round)
    if room['status'] != "BETTING":
        await emit_update(room_id)

@sio.on("delete_room")
async def handle_delete_room(sid, data):
    room_id = data.get("room_id")
    if room_id in rooms:
        # Notify players
        await sio.emit("error", {"message": "Table closed by admin"}, room=room_id)
        # Update room list for everyone
        del rooms[room_id]
        await broadcast_room_list()

@sio.on("bj_place_bet")
async def handle_bj_bet(sid, data):
    room_id = data.get("room_id")
    bet = int(data.get("bet", 10))
    if room_id not in rooms:
        await sio.emit("error", {"message": "Room not found (expired?)"}, to=sid)
        return
    room = rooms[room_id]
    
    all_bets_placed = True
    for p in room['players']:
        if p['sid'] == sid:
            p['bet'] = bet
            p['status'] = "READY"
            p['hands'] = [] 
        
        # Check if everyone is ready (excluding people who might have joined mid-game if we allowed that logic, but here we keep it simple)
        if p['status'] != "READY":
            all_bets_placed = False
            
    if all_bets_placed and len(room['players']) > 0:
        await start_bj_round(room_id)
    else:
        await emit_update(room_id)

async def start_bj_round(room_id):
    room = rooms[room_id]
    room['status'] = "PLAYING"
    room['turn_index'] = 0
    room['dealer_hand'] = []
    room['deck'] = create_deck()
    
    # Deal initial hands
    for p in room['players']:
        p['status'] = "PLAYING"
        p['hands'] = [{
            "cards": [],
            "bet": p['bet'],
            "status": "PLAYING",
            "score": 0
        }]
        p['active_hand_index'] = 0
        
    for _ in range(2):
        for p in room['players']:
            p['hands'][0]['cards'].append(room['deck'].pop())
        room['dealer_hand'].append(room['deck'].pop())
        
    for p in room['players']:
        h = p['hands'][0]
        h['score'] = calculate_score(h['cards'])
        if h['score'] == 21: h['status'] = "BLACKJACK" # Mark blackjack immediately

    # If first player has blackjack, auto advance
    current_p = room['players'][room['turn_index']]
    if current_p['hands'][0]['status'] == "BLACKJACK":
        await next_turn(room_id)
    else:
        await emit_update(room_id)

@sio.on("bj_action")
async def handle_bj_action(sid, data):
    room_id = data.get("room_id")
    action = data.get("action")
    if room_id not in rooms: return
    room = rooms[room_id]
    if room['status'] != "PLAYING": return
    
    active_player = room['players'][room['turn_index']]
    if active_player['sid'] != sid: return
    
    current_hand_idx = active_player['active_hand_index']
    if current_hand_idx >= len(active_player['hands']): return # Should not happen
    current_hand = active_player['hands'][current_hand_idx]

    if action == "HIT":
        current_hand['cards'].append(room['deck'].pop())
        current_hand['score'] = calculate_score(current_hand['cards'])
        if current_hand['score'] >= 21:
            current_hand['status'] = "BUST" if current_hand['score'] > 21 else "STAND"
            await next_turn(room_id)
        else:
            await emit_update(room_id)
            
    elif action == "STAND":
        current_hand['status'] = "STAND"
        await next_turn(room_id)
        
    elif action == "DOUBLE":
        if len(current_hand['cards']) == 2:
            current_hand['bet'] *= 2
            current_hand['cards'].append(room['deck'].pop())
            current_hand['score'] = calculate_score(current_hand['cards'])
            current_hand['status'] = "BUST" if current_hand['score'] > 21 else "STAND"
            await next_turn(room_id)
            
    elif action == "SPLIT":
        can_split = (
            len(current_hand['cards']) == 2 and 
            (current_hand['cards'][0] % 13) == (current_hand['cards'][1] % 13)
        )
        if can_split:
            # Create new hand
            new_hand = {
                "cards": [current_hand['cards'].pop()],
                "bet": current_hand['bet'],
                "status": "PLAYING",
                "score": 0
            }
            # Deal to current
            current_hand['cards'].append(room['deck'].pop())
            current_hand['score'] = calculate_score(current_hand['cards'])
            
            # Deal to new
            new_hand['cards'].append(room['deck'].pop())
            new_hand['score'] = calculate_score(new_hand['cards'])
            
            # Insert new hand after current
            active_player['hands'].insert(current_hand_idx + 1, new_hand)
            
            await emit_update(room_id)

async def next_turn(room_id):
    room = rooms[room_id]
    active_player = room['players'][room['turn_index']]
    
    # Move to next hand if available
    if active_player['active_hand_index'] < len(active_player['hands']) - 1:
        active_player['active_hand_index'] += 1
        # Check if next hand is already done (e.g. from aces split or something, though simplified here)
        # For now, assume always playing
        await emit_update(room_id)
    else:
        # Move to next player
        room['turn_index'] += 1
        if room['turn_index'] >= len(room['players']):
            await dealer_play(room_id)
        else:
            # Check if next player has blackjack
            next_p = room['players'][room['turn_index']]
            if next_p['hands'][0]['status'] == "BLACKJACK":
                await next_turn(room_id)
            else:
                await emit_update(room_id)

async def dealer_play(room_id):
    room = rooms[room_id]
    room['status'] = "FINISHED"
    dealer_score = calculate_score(room['dealer_hand'])
    while dealer_score < 17:
        room['dealer_hand'].append(room['deck'].pop())
        dealer_score = calculate_score(room['dealer_hand'])
    await emit_update(room_id)

async def emit_update(room_id):
    room = rooms[room_id]
    active_player = room['players'][room['turn_index']] if room['turn_index'] < len(room['players']) else None
    
    update_data = {
        "players": [
            {
                "sid": p['sid'],
                "profile": p['profile'],
                "hands": p['hands'],
                "active_hand_index": p['active_hand_index'],
                "status": p.get('status')
            } for p in room['players']
        ],
        "dealer_hand": [room['dealer_hand'][0], -1] if room['status'] != "FINISHED" else room['dealer_hand'],
        "status": room['status'],
        "turn_index": room['turn_index'],
        "active_player_sid": active_player['sid'] if active_player else None
    }
    await sio.emit("bj_update", update_data, room=room_id)

@sio.on("send_move")
async def handle_move(sid, data):
    room_id = data.get("room_id")
    payload = data.get("payload")
    if room_id: await sio.emit("receive_move", payload, room=room_id, skip_sid=sid)

socket_app = socketio.ASGIApp(sio)
