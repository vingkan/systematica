# **Systematica Game Notes**

# **Game Design Journal**

## **Sep 23, 2024**

### **Prompt**

We are creating a card game about designing software systems.

Players

The game has two players. The server player will use the server deck to build a backend system. The client player will use the client deck to send requests to the system.

Objectives

The server player’s goal is to maximize their points scored across four objectives:

1. Throughput: score a certain number of points for completing a request
2. Availability: lose a certain number of points for requests that are not completed within a certain number of turns
3. Consistency: lose a certain number of points if the rules of a request are violated
4. Cost: lose a certain number of points for each server card in play based on the kind of system component it is

The client player’s goal is to minimize the server player’s points scored.

Decks

The server player’s deck consists of four types of cards:

1. Compute: core infrastructure to carry out server-side operations
2. Storage: data stores that enable reading and writing data
3. Network: patterns for handling connections between components
4. Application: business logic to handle requests

The client player’s deck consists of two types of cards:

1. Requests: calls to the server with conditions to be met
2. Effects: modifiers that can change the behavior of requests or server components

Gameplay

Before the game, both players review their decks to understand what cards they can use. There is no hand or drawing mechanic in this game, so both players have access to all of their cards at any time.

In the setup phase, the server player plays their cards to design their system while the client player plans what order to send their cards in.

On each turn, the server player goes first, they can add or remove as many cards as they wish to their system design. After the server player is done, the client player can play up to ten cards, in any order or combination they wish. Sometimes, the rules of a card will allow the client player to play more than ten cards in a turn. As the cards are played, both players follow the rules of the cards to take each request through the system to determine its outcome. Request cards can be in one of three states on any turn: active, completed, or failed. Completed and failed cards count towards objective scoring, active cards do not. Active cards can eventually become completed or failed based on the rules of the cards.

The client deck comes with instructions that set the maximum number of turns. After the last turn finishes, calculate the scores so each player can understand their performance. There is no explicit winner or loser in a game, but you can compare players’ scores across different games to see who performed best. For example, if a client player limited their opponent to 5 points, we would say they outperformed another client whose opponent scored 10 points. The same is true for server players, but with more points being more desirable.

Scenario

The first pair of decks we will create for this game are for a system that processes ticket sales, like Ticketmaster or Eventbrite. In this scenario, the users are fans who want to buy tickets for an event that is in high-demand and the server has to process these requests. Users search for events, then try to hold a ticket for the event. Once they get a ticket hold, they have a certain amount of time to complete their purchase before that ticket hold expires and another user can try to purchase it.

Deck Composition

The client deck has three kinds of request cards:

1. View Event: a user attempts to view an event. To be completed, this request card must get forwarded to an application card called Read Event and meet the conditions of that card. When this card is completed, the client player must play a Hold Ticket card. This card is not worth any throughput points, but if it fails, it can count against the server player’s availability or consistency scores.
2. Hold Ticket: a user attempts to reserve a ticket so that they can purchase it. To be completed, this request card must get forwarded to an application card called Write Ticket Hold and meet the conditions of that card. When this card is completed, the client player must play a Purchase Ticket card. This card is not worth any throughput points, but if it fails, it can count against the server player’s availability or consistency scores.
3. Purchase Ticket: a user attempts to purchase a ticket. To be completed, this request card must get forwarded to an application card called Payment Service and meet the conditions of that card. This card counts towards the server player’s throughput score and if it fails, it can count against the server player’s availability or consistency scores.

The client deck has three kinds of effect cards:

1. Stampeding Herd: Allows the client player to play up to ten additional cards this turn.
2. Payment Error: This card can be attached to any active Purchase Ticket request card. If attached, it causes that card to be worth zero points if completed, however any consistency penalties from that card will also have no effect.
3. Race Condition: To play this card, exactly two Race Condition cards must be played at the same time, attached to different active Hold Ticket cards. If attached, it causes those cards to fail consistency. If the Hold Ticket card is completed, attach this card to the resulting Purchase Ticket card. At the end of the game, pair up each completed Purchase Ticket card with Race Condition attached, these cards are worth zero completion points and their consistency penalties activate. If there are any Race Condition cards that do not form a pair, they have no effect on scoring.

The server deck has three kinds of application cards:

1. Payment Service: This card provides its own compute, storage, and network. This card can have up to two application cards connected to it. This card can have up to six request cards on it. When request cards reach this card, keep them there for one turn. After that turn, if the card is still active, try to write to the relational storage card connected to the application that the request card came from. If the write is successful, the request card is completed, otherwise the request is failed.
2. Read Event: This card must be connected to a compute card and a relational storage card to take effect. If a View Event request card reaches the compute card, try to read from the storage card. If the read is successful, the request card is completed, otherwise keep it on the compute card until the next turn.
3. Write Ticket Hold: This card must be connected to a compute card and a storage card to take effect. If a Hold Ticket request card reaches the compute card, try to write to the storage card. If the write is successful, the request card is completed, otherwise keep it on the compute card until the next turn.
4. Write Purchase: This card must be connected to a compute card, a relational storage card, and a Payment Service card to take effect. If a Purchase Ticket request card reaches the compute card, try to move the request card to the Payment Service card, otherwise keep it on the compute card until the next turn.

The server deck has two kinds of compute cards:

1. Cloud Function: This card can have only one application card connected to it. This card can only have one request card on it.
2. Container: This card can have up to four application cards connected to it. This card can have up to eight request cards on it.

The server deck has two kinds of storage cards:

1. Relational Database: This is a relational storage card. This card can have any number of application cards connected to it. You can write to this card three times per turn, after that, writes on this turn will fail. You can read from this card five times per turn, after that, reads on this turn will fail.
2. Key Value Store: This card can have any number of application cards connected to it. You can write to this card ten times per turn, after that, writes on this turn will fail. You can read from this card ten times per turn, after that, reads on this turn will fail.

The server deck has two kinds of network cards:

1. Round Robin Load Balancer: This is an entrypoint, request cards can be played here. You can use this card up to 20 times per turn. This card can be connected to any number of compute cards. The first compute card connected to this card is called the target. When a request card reaches this card, try to move the request card to the target compute card, if you cannot move it to that card, then keep it on this card. Then, make the next connected compute card the target. If you give a request card to the last compute card, the next target is the first compute card.
2. Least Connections Load Balancer: This is an entrypoint, request cards can be played here. You can use this card up to 20 times per turn. This card can be connected to any number of compute cards. When a request card reaches this card, try to move the request card to the connected compute card with the fewest request cards on it, if you cannot move it to that card, then keep it on this card.

Card List

Now, produce a card list for each deck. For each card in each deck, list the quantity of that card and specify any point values that need to be assigned to that card based on its role. Design the point values to make the game realistic to system design principles and balanced between the client and server players.

### **Response (o1-preview)**

[https://chatgpt.com/share/66f26f61-4c00-8007-adb0-0812b94faf64](https://chatgpt.com/share/66f26f61-4c00-8007-adb0-0812b94faf64)

### **Revision Ideas**

- Goals
  - Make the playthrough faster
  - Reduce the learning curve
  - Make the scoring easier to calculate
- Simpler phases
  - Phase 1: Build
    - The server player follows a guide to make a choice on each of three binary trade-offs, while the client player gives advice that could be either helpful or deceitful
    - The server player’s choices on those three decisions lead to one of eight possible system designs and they play their cards accordingly
  - Phase 2: Smoke Test
    - The client player plays a single request card, in this case, we start with the View Event card
    - The server player takes this card through the entire system to verify that it is possible for them to complete a request
  - Phase 3: Ramp Up
    - The client player can now play five cards per turn, for two turns
  - Phase 4: Peak Load
    - The client player can now play ten cards per turn, for two turns
- Simpler scoring
  - Remove the penalties for availability and consistency
  - Instead, the availability and consistency rules just cause some requests to fail and not be worth any throughput points
  - Thus, the final score will be throughput points minus cost
  - Scale up the throughput points for completed Purchase Ticket requests so that the server player can actually earn more points than the cost of their system

### **Notes**

- Prototype game scope
  - Client player scans their deck, chooses some cards to reveal to server player
    - Scope cuts? Server player discards some client cards
  - Server player reads their deck, prepares to build
  - Server player shuffles their deck and draws?
    - Or just have the whole deck and a limited number of plays per turn?
  - Server player builds
  - Client player sends requests, sometimes with attachments
  - Score the requests and add to the total
  - Start with fixed objectives and scoring, in the future, let the client player tweak these to make the challenge harder
- Objective Cards (scoring)
  - Throughput: X completed ticket purchases in Y turns
  - Availability: \<X dropped requests, requests drop after Y turns
  - Consistency: \<X invalid requests, depending on request conditions
  - Cost: \<X total spend, based on benchmark
- Basic client deck (removed all optional requests)
  - Data
    - Events
      - Regular Event
      - Large Event
    - Storage
      - Ticket Key/Values
      - Payments Table
  - API Requests
    - List Events
    - Hold Ticket
    - Purchase Ticket
  - Request Modifiers
    - Stampeding Herd (Multiply Traffic 10x)
    - Race Condition
    - Cache Miss
    - Payment Failure
    - Hold Timeout
    - Redis Restart
- Basic server deck
  - Business Logic
    - Read: Serve Event
    - Write: Reserve Ticket
      - Exchange for Purchase Ticket Request
    - Write: Purchase Ticket
  - Applications
    - Third-Party Payment Processor
      - Attach Network Request (Long Poll or Webhook)
- Main Trade-Offs
  - Network: Autoscaler or Load Balancer
  - Compute: Serverless or Containers
  - Storage: Cache Pattern
    - Write Back
    - Write Through
- Architectures
  - Approach A:
    - Serverless functions with autoscaler
  - Approach B

## **Sep 20, 2024**

- Brainstorm Application Use Cases
  - Search engine
  - Audio transcription
  - Social media platform
  - Ride-sharing
  - E-commerce store
  - Food delivery
  - Collaborative editing
  - Job search site
  - Video streaming
  - Event management site
  - Online learning platform
  - Hotel booking site
- Ticket Booking Website
  - Functional Requirements
    - User can view all events available
    - User can search for a specific event
    - User can purchase a ticket for an event
    - User can view map of seats available for an event
    - User can hold their ticket and seat for a certain amount of time while waiting to finalize and pay
    - User can only purchase up to one ticket per event
    - User can sign up to get notified when ticket sales go live for a future event
  - Implications
    - User should not be able to take a seat that someone else is holding
    - Seats should become available if a user did not pay in time
    - Tickets should no longer be available once all seats are sold
  - Non-Functional Requirements
    - Availability: Should not go down when many people try to buy tickets
    - Latency: Should update seat map within 500ms (stretch goal: 250ms)
    - Security: Should secure payment details and prevent users from getting tickets without paying
  - Assumptions
    - Assume that users can only select one seat at a time
    - Assume that all events are already uploaded into the system and do not need to be changed
  - Estimates
    - Taylor Swift at SoFi Stadium: 70,000 attendees per event
    - Assume that 1 in 10 people who tried to get a ticket when sales opened was not able to get one
    - Assume that with bots, this factor could be another 10x
    - 70K ticket holders x 10 hopeful buyers \= 700K users at launch per event
    - Assume 10 major events open ticket sales at the same time
    - 700K users x 10 events \= 7M users
    - Will need to add jitter to prevent a stampeding herd
    - Up to 70K fans can check seats at once per event
    - 70K concurrent users x 10 events \= 700K concurrent ticket/seat holds
    - Assume users click three seats per second
    - 70K x 3 \= 210K qps per event while checking seats
    - 210K qps x 10 events \= 2.1M qps
    - Load tapers off as people successfully purchase tickets
    - Assume a 10 minute time limit to pay
    - Assume that 20% of users will not pay within the time limit due to not purchasing in time or using invalid payment details (expiration rate)
    - This means the first batch of users trying to purchase tickets at time 0 mins will have 2.1M qps, then next batch at 10 mins will have 20% of that, so 420K qps, then the next batch at 20 mins will have 20% of that, so 84K qps, continuing to decrease exponentially
    - After five batches (50 mins), the load will have fallen to 672 qps
    - At 20% expiration rate, could take 10 batches (100 mins) to sell all tickets
    - With lower expiration rate and jitter, can also control peak load here
  - Trade-Offs
    - Seat Map Consistency vs Availability
      - Ensuring the correct seats are locked can increase latency
      - To get a seat, the first writer wins, if we have multiple instances of the service that processes seat requests, we need to coordinate across them to ensure that only one wins
      - May want to separate some of the services so that load or latency in one component does not cause the whole site to go down
    - Caching vs Durability
      - We want to reduce latency for operations, so we can use a key-value store with low round-trip latency to our backend
      - However, the key-value store is also critical for the correctness of our booking logic, so we need it to be durable in the face of restarts or key expiration
      - This key-value store should NOT be a cache, because keeping the cache in sync with the database would risk inconsistencies or add latency to the backend
      - Instead, we should configure the key-value store to be durable: use an append-only setting with a distributed write lock
      - We do not need a read lock because there will be many more readers than writers and the caller does not need to confirm that a seat is free or taken until the hold write succeeds
      - Keys for ticket and seat holds can be configured to expire according to the time limit, or can be deleted sooner if a user requests to change the seat they are holding
      - The actual ticket sales will be persisted to a relational database, that way we do not to rely on the key-value store for long-term durable storage
      - We can also set a maximum time window for the ticket sale, we estimated that all tickets will be claimed within 100 mins, less than 2 hours, so we could set a maximum 3 hour time limit on ticket sales and all other data in the key-value store for an event expire after that amount of time
      - This means the key-value store should not grow beyond a size proportional to the maximum load we estimated
      - The relational database can continue to grow because it is not on the critical path for the low-latency hold endpoints, with an index on event ID, that database can be queried to get ticket sales for an event or aggregated by event
    - Payment Processor Call Pattern
      - Should we send a payment request from our server to the payment processor server?
      - Or should we redirect our users to the payment processor’s application and let them callback to our service?
      - Redirecting to the payment processor reduces the complexity for our service because we do not have to handle the user’s sensitive payment information and we will receive events for the outcomes of payments
      - Sending requests to the payment processor means we need to securely store payment information in either the client or server and handle failure cases
      - Suppose we can come to an agreement with the payment processor vendor where we get dedicated capacity if we use send requests to their server, given that our ticket sale events will introduce much higher load, which they don’t want to have hitting their general integration
    - Payment Processing Reliability
      - We call out to an external payment processor whose latency is out of our control
      - We may have to increase the latency and reduce the throughput of our system in order to ensure the reliability of payments
      - Users will be upset if they miss out on a ticket because payment processing took too long and caused their time to expire, so we should probably add some hidden buffer time to the ticket expiration to account for the 99th percentile latency of the payment processor that way as long as the user starts their purchase within the time limit, they should still get the ticket
      - The payment processor either explicitly enforces a rate limit on us or has a practical rate limit past which it will become unreliable that we can learn through monitoring, so we may need to throttle or retry our payment attempts
    - Payment Processing Durability
      - How much do we care about durability?
      - If a user sends a payment that fails and while retrying it, our system restarts and we lose their payment, do we leave it to the user to try again or do we need to make sure we do not lose it?
      - Since we have a 10 minute time window, we can push the retry responsibility to the user and show their status as incomplete until it succeeds
      - But we should track whether they have a payment currently processing that way our frontend application can prevent the user from spamming our system with retries
      - And since we could even lose the payment processing status to a system restart, we should have that status expire after a certain amount of time so the user can retry the payment
    - Payment Processing Idempotency
      - We should not process more than one payments for the same user for the same ticket/seat
      - If users are retrying payments, make sure we do not create a new payment when one is in process or has already succeeded
  - API Design
    - GET /events/list
      - List all events, with pagination
    - GET /events/search
      - Search events via text query, with pagination
    - GET /event/:eventid/seatmap
      - Get map of seats for event to display in the frontend
      - Easy to cache on the frontend
      - Does not indicate which seats are taken
    - GET /event/:eventid/seats
      - Get status of all seats for the event
      - Need to send both free and taken/held seats so that frontend can prevent users from trying to claim taken/held seats
    - GET /event/:eventid/userstatus
      - Check whether the user is eligible to buy a ticket
      - User is not eligible if they already bought a ticket or if all tickets are currently held by other users
    - POST /event/:eventid/holdticket
      - Attempt to hold a ticket
      - Frontend will show a loading state until it receives a successful response that you have claimed a ticket, which then allows you to proceed to seat selection and payment
      - The call pattern for this request is synchronous because our response time target is \<500ms
    - POST /event/:eventid/holdseat/:seatid
      - Attempt to hold a seat
      - Frontend will show a loading state on that seat until it receives a successful response that you have claimed the requested seat
      - The call pattern for this request is synchronous because our response time target is \<500ms
    - POST /event/:eventid/purchaseticket
      - Send payment information encrypted in POST request body
      - Returns a purchase ID that we can poll for the result
      - The call pattern for this request is asynchronous because the payment could take some time to process and we don’t want to keep our backend occupied by long-running requests
    - GET /event/:eventid/purchasestatus/:purchaseid
      - Check status of purchase, one of: in-progress, succeeded, failed
      - Frontend can poll this endpoint every 3 seconds
  - Components
    - Network
      - Application Load Balancer
        - Serve as a reverse proxy for incoming requests
        - Distribute requests across handlers
        - Start with round robin, then monitor load distribution, which could be affected by users taking different amounts of time to complete payments or hitting their hold expiration
        - Could also use endpoint path to route requests to different servers, that way seat map read requests don’t overwhelm a server trying to process payments
      - Third-Party Payments
        - Use a third-party service to process payments
      - Third-Party Authentication
        - Use a third-party service to authenticate our users, helping prevent against bots that spam to get tickets
    - Storage
      - Redis
        - Key-value store for ticket holds and seat selections
        - Redis is designed to hold up to 250M keys
        - Since our expected concurrent ticket holds is on the order of 700K, we have headroom for \~300x that load
        - Could increase by a factor of 2-5 if we add more keys per ticket hold, for example: seat or payment status
        - Set a time window for ticket sales
      - Postgres
        - Relational store for events and completed ticket sales
    - Compute
      - API Backend
        - Processes endpoints described above
        - Reads from Redis to check ticket holds and seat holds
        - Writes to Redis to place ticket holds and seat holds
        - Reads from Postgres to get events and seat maps
        - Writes to Postgres to save ticket sales
        - Sends requests to third-party payment processor
  - Advanced Requirements
    - Vendors can create events
    - Vendors can select venues to get seat maps
    - Vendors can set ticket prices
    - Vendors can see how many tickets have been sold
- ChatGPT Feedback
  - Partition by Event ID: I was thinking this, but should have said it 😅
  - Redis Lua Script: Use SETNX (set if not exists) in the case where two processes incorrectly think they have acquired the distributed lock, does this reply with whether or not the write succeeded?
  - Payment Webhook: Even if you get dedicated capacity, having the payment processor call back to you is probably still better for both parties
  - Circuit Breaker: If Redis goes down, ticket/seat holds should stop
  - Optimistic Hold: Try to hold the seat, then confirm at ticket purchase time, user may have to go back (worse UX), but could reduce write contention
  - Autoscaling: Not all times will be peak load, don’t want to pay the costs unless we need to, doesn’t need to be a very dynamic autoscaler, since we know what times event ticket sales will open
  - Spam Prevention: CAPTCHAs and other bot detection approaches, may also need a ban list (can expire) for bad actors
  - Rate Limiting: Add this to the application load balancer, how much logic can you configure in an ALB?
  - Relational vs Non-Relational: The key to non-relational databases is the eventual consistency, which allows them to horizontally scale for faster throughput with eventual consistency. Also makes sharding easier, while relational databases have to maintain constraints and ACID guarantees across shards, which becomes more complex. This is why vertical scaling is more common for relational databases. Non-relational databases may also denormalize data, leading to redundancy, but enabling fast reads without joins.
- AWS Compute Options
  - Prompted by this Medium article ([link](https://aws.plainenglish.io/different-ways-to-host-apis-in-aws-0ce3ad0ef673))
  - Good ChatGPT discussion ([link](https://chatgpt.com/share/66ee6bae-2c20-8007-ace0-3eda8e7f5752))
  - Choices:
    - Serverless Function (AWS Lambda)
    - Serverless Container (AWS Fargate)
    - Managed Container (AWS EC2)
    - Managed Container Service (AWS ECS)
    - Managed Application (AWS Elastic Beanstalk)
- Main Trade-Offs
  - Payment Call Pattern: Sync or Async
  - Client Call Pattern: Sync or Async
  - Load Balancer Algorithm: Static Round Robin or Dynamic Least Connection
  - Database Type: Relational or Non-Relational
  - Caching Update Pattern: Write-Through or Write-Back Cache
- Cards
  - Network
    - Load Balancer
      - Attach Load Balancing Algorithm
        - Round Robin (Static)
        - Least Connection (Dynamic)
    - Long Poll Request
    - Webhook Request
  - Storage
    - Relational Database
      - Attach Read Replicas (Only supports Read-Only data)
    - Non-Relational Database
      - Attach Shards
    - Cache
      - Attach Caching Update Pattern
        - Write-Through
        - Write-Back
  - Compute
    - Serverless Function Service
      - Attach Functions (Can be Producer or Consumer)
        - Attach Business Logic
    - Managed Container Service
      - Attach Containers (Can be Producer or Consumer)
        - Attach Business Logic
    - Message Queue Service
      - Connect to Broker
      - Connect to Producers
      - Attach Consumers
  - Application
    - Event Management Logic
      - Supports creating, listing, searching, and viewing events
    - Event Ticketing Logic
      - Supports holding tickets, viewing seats, holding seats, and purchasing tickets
    - Third-Party Payment Processor
      - Attach Network Request (Long Poll or Webhook)
    - Tools
      - Distributed Lock
      - Event Partition
  - Request
    - API Requests
      - Create Event (Read-Only, Optional)
      - List Events
      - Search Events (Optional)
      - View Event (Optional)
      - Hold Ticket
      - View Seats (Optional)
      - Hold Seat (Optional)
      - Purchase Ticket
    - Request Modifiers
      - Stampeding Herd (Multiply Traffic 10x)
      - Refresh Spam
      - Bot User Request
      - Invalid Payment Failure
      - Flaky Payment Failure
