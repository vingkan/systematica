# Ticket Booking Example

Let me describe to you an example of the flow of the game. This will show what the rules, workflow, and interactions should be.

Each player’s deck should have 30 cards. We can run simulations to calibrate and balance the quantity of each card and their values, but for now I will describe the general dynamics.

## Rules

From the menu, players can read the rules. Below, I present the rules as precisely as I can. You can make them more concise in the menu rulebook, then enforce them precisely during gameplay.

1. There are two players: the server and the client.
2. The server player has a deck of 30 cards, with network, compute, storage, and application cards.
3. The client player has a deck of 30 cards, with request and effect cards.
4. Before the game, both players can see all of the cards in each others’ decks. During the game, only cards played face up on the board are visible to the other player.
5. The scoreboard consists of slots for consistency, availability, cost, and requests.
6. The game has SLAs for value ((consistency \* 20\) \- cost), uptime (availability / requests), and efficiency (cost / request). The server player must pass all three SLAs to win, otherwise the client player wins.
7. The server and client player each get three turns.
8. At the start of each turn, the server player builds or adjusts their system by playing as many cards from their deck as they like onto the server board.
9. The server board consists of four layers: network on top, compute beneath that, application beneath that, and storage on the bottom.
10. Application cards are played to connect one compute card to one storage card. Compute and storage cards have a limit to their number of application connections.
11. At the end of the server player’s turn, add up all the fixed costs of their system and add them to the cost slot on the scoreboard.
12. The client player goes next by placing up to five request cards face down on the client board, from left to right in the order of their choosing.
13. The client player can attach as many effect cards face down to as many request cards as they wish.
14. At the end of the client player’s turn, the server player flips and resolves the request cards one-by-one from left to right.
15. To resolve a request card, the server player must navigate it through the network, compute, and storage layers according to the card’s requirements.
16. If the requirements of a request card cannot be fulfilled, it stops at that server card and occupies its capacity up to the unfulfilled volume.
17. If the next server card a request would navigate to lacks capacity for the volume of the incoming request card, it stops at the previous card and occupies its capacity up to the unfulfilled volume.
18. If the request volume cannot be fulfilled by even the network layer, it stops before entering the server.
19. For every request sent, add its volume to the requests slot on the scoreboard.
20. For every request processing step that incurs cost, add that amount to the cost slot on the scoreboard.
21. For every fulfilled request, calculate the volume of fulfilled requests and add that amount to the availability slot on the scoreboard.
22. For every fulfilled request, calculate the value for the volume of fulfilled requests and add that amount to the consistency slot on the scoreboard.
23. Unfulfilled requests do not add to the availability slot. The lack of availability points is sufficient to reduce uptime in the final results.
24. After resolving all the client player’s cards, those cards are discarded and the server player’s next turn begins.
25. After the third turn, calculate the scores for value, uptime, and efficiency and determine the winner.

Once the players start the game, the board is divided into two halves: the server player on the left and the client player on the right. There is a scoreboard at the top middle of the board, which shows three slots: consistency, availability, and cost.

Both players can view their entire deck at any time by expanding the deck view at the bottom of their half of the board.

## Server Deck

The server player’s deck contains network, compute, storage, and application cards, with 30 cards total. These are the contents and quantities in the deck:

- 1x Round Robin Load Balancer (Network)
  - Cost: 5 points per turn
  - Capacity: 100 concurrent requests
  - Functionality: Requests route to the next compute card from the left
- 1x Least Connections Load Balancer (Network)
  - Cost: 10 points per turn
  - Capacity: 100 concurrent requests
  - Functionality: Requests route to the compute card with the most free capacity
- 2x Container (Compute)
  - Cost: 10 points per turn
  - Capacity: 40 concurrent requests, up to 4 application cards
  - Functionality: Requests route via the relevant application card
- 4x Cloud Functions (Compute)
  - Cost: 1 point per request processed
  - Capacity: 100 concurrent requests, one application card
  - Functionality: Requests route via the relevant application card
- 1x Relational Database (Storage)
  - Cost: 10 points per turn
  - Capacity: 40 concurrent requests, up to 5 application cards
  - Functionality: Satisfies a read or write, durable
- 1x Key-Value Store (Storage)
  - Cost: 5 points per turn
  - Capacity: 100 concurrent requests, up to 10 application cards
  - Functionality: Satisfies a read or write, reduces its cost by 1 point, not durable
- 8x Read Event (Application)
  - Cost: 1 point per request processed
  - Capacity: Same as compute deployed on
  - Functionality: Reads event details from storage
- 6x Write Hold (Application)
  - Cost: 2 points per request processed
  - Capacity: Same as compute deployed on
  - Functionality: Writes ticket hold to storage
- 6x Write Payment (Application)
  - Cost: 3 points per request processed
  - Capacity: Same as compute deployed on
  - Functionality: Writes payment record to storage

The metagame for the server player is to make three core trade-offs:

1. Use round robin or least connections load balancing: trade cost vs capacity utilization
2. Use containers or cloud functions or both: trade cost vs elastic capacity
3. Use relational database or key-value store or both: trade cost vs write durability

## Client Deck

The client player’s deck contains request and effect cards, with 30 cards total. These are the contents and quantities in the deck:

- 10x View Event (Request)
  - Volume: 10 requests
  - Value: 1 point per fulfilled request
  - Requirements: Must fulfill Read Event
- 5x Hold Ticket (Request)
  - Volume: 4 requests
  - Value: 1 point per fulfilled request
  - Requirements: Must fulfill Write Hold
- 5x Purchase Ticket (Request)
  - Volume: 4 requests
  - Value: 1 point per fulfilled request
  - Requirements: Must fulfill Write Payment
- 1x Stampeding Herd (Effect)
  - Volume: Doubles volume
  - Value: No change
  - Requirements: Can attach to any request
- 3x Race Condition (Effect)
  - Volume: No change
  - Value: Reduces value by half, if storage is not durable
  - Requirements: Can attach to a write request
- 6x Server Error (Effect)
  - Volume: No change
  - Value: Reduces value to 0
  - Requirements: Can attach to any request

The metagame for the client player is to identify and attack these weaknesses in the server by sequencing their cards optimally:

1. Break availability by exploiting load balancing or compute/storage capacity
2. Break consistency by exploiting non-durable storage or causing requests to error
3. Increase cost by targeting elastic compute or triggering expensive reads

## Example Game Flow

Here is a minimal, example game that you can write integration tests and smoke tests for to ensure that both the engine and the UI work correctly. This example is overly simplified to clearly show some of the mechanics. You should extend it to write better test scenarios that exercise all the rules, cards, and mechanics.

- SLAs
  - Value: \>50
  - Uptime: \>95%
  - Cost: \<8 points per request
- Turn One
  - Server player:
    - Plays one Least Connections Load Balancer
    - \+10 cost
    - Plays one Container
    - \+10 cost
    - Plays one Relational Database
    - \+10 cost
    - Plays one Key-Value Store
    - \+5 cost
    - Plays one Read Event to connect Container to Key-Value Store
    - Plays one Write Hold to connect Container to Key-Value Store
    - Plays one Write Payment to connect Container to Relational Database
    - Ends turn
  - Client player:
    - Plays one View Event
    - Plays one Hold Ticket
    - Attaches one Stampeding Herd to Hold Ticket
    - Attaches one Race Condition to Hold Ticket
    - Ends turn
  - Resolution:
    - View Event hits server
    - \+10 requests
    - Server must send View Event to Least Connections Load Balancer
    - Server must send View Event to Container
    - Server must send View Event to Read Event
    - \+10 cost
    - Server must send View Event to either storage card
    - Server chooses to send View Event to Key-Value Store
    - \-10 cost
    - \+10 consistency
    - \+10 availability
    - \-10 capacity from Key-Value Store
    - Hold Ticket hits the server
    - \+8 requests
    - Server must send Hold Ticket to Least Connections Load Balancer
    - Server must send Hold Ticket to Container
    - Server must send Hold Ticket to Write Hold
    - \+16 cost
    - Server must send Hold Ticket to Key-Value Store
    - \-8 cost
    - Key-Value Store is not durable
    - \+4 consistency
    - \+8 availability
    - \-8 capacity from Key-Value Store
- Turn Two
  - Server Player:
    - Has one Least Connections Load Balancer
    - \+10 cost
    - Has one Container
    - \+10 cost
    - Has one Relational Database
    - \+10 cost
    - Has one Key-Value Store
    - \+5 cost
    - No actions
    - Ends turn
  - Client Player:
    - No actions
    - Ends turn
- Turn Three
  - Server Player:
    - Has one Least Connections Load Balancer
    - \+10 cost
    - Has one Container
    - \+10 cost
    - Has one Relational Database
    - \+10 cost
    - Has one Key-Value Store
    - \+5 cost
    - No actions
    - Ends turn
  - Client Player:
    - No actions
    - Ends turn
- Results
  - Cost \= 113
  - Requests \= 18
  - Availability \= 18
  - Consistency \= 14
  - Value \= 280 \- 113 \= 167 (passed)
  - Uptime \= 18/18 \= 100% (passed)
  - Efficiency \= 113/18 \= 6.28 points per request (passed)
  - Server player wins
