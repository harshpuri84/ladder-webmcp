# Ladder — the disruption reframe

**Design note, 2026-08-27.** Supersedes the demo scenario in the original spec. The engine does
not change. What changes is the fixture model, the tool surface, and the story.

## Why the old scenario failed

The demo asked an operator to bulk-edit shipment status, price and ETA. Research against real
forwarding practice found that operators do not do this. The unit of work is the file, worked one
at a time out of an inbox, and statuses and ETAs arrive from carrier feeds rather than from
someone selecting rows. The first objection from anyone who has run a station is "we don't do
that", and they are right.

## The reframe, and the correction that makes it work

Nobody chooses the batch. A disruption does.

The structural point, which is better than the framing it replaces: **the batch is the consol.**
One master air waybill carries many house shipments for different customers on one flight. When
the flight cancels, the affected list already exists in the forwarder's system. Nobody assembles
it. That is per-file exception handling arriving forty at a time, which is exactly how the work
actually happens.

## The scenario

Thursday, 19:40, Frankfurt. The carrier cancels tonight's widebody to Chicago. Two consols are
aboard: **42 house shipments, 31 customers**, now unbooked.

Three alternatives, each with its own clock:

| Option | Leaves | Cost | Recovers |
|---|---|---|---|
| Same carrier, next morning | 08:10 | nothing | limits the delay to ~18h |
| Competitor freighter at spot | 23:55, cutoff 22:00 | rate delta | tonight |
| Truck to Amsterdam, fly from there | 21:30 | ~EUR 1,300 plus surcharge delta | one day instead of two |

Ninety minutes to decide.

## What each side does

The agent does what a human cannot do in ninety minutes: for all 42, pull the promised delivery
window and SLA exposure, the cargo flags, live space and spot price on each alternative, and the
cost and recovered time of each remedy. An operator opening files serially manages maybe eight.

The human decides whose delay to buy back with whose money. Spend authority is real, and the
operator knows things the system does not: this customer is mid-negotiation, that "general cargo"
is a launch shipment, the competitor freighter has burned us on transfer handling before.

## Options differ across rows, not within them

One recommended remedy per row with its cost and recovered time. Most rows share the cheap one.
A handful are genuinely contested. This is both the honest model and a far smaller interface than
three choices on forty rows.

## The constraint layer, which is what makes the variety honest

Each remedy is checked against each shipment. A blocked option carries the rule that blocked it.
Engineers read this as a policy engine, and that is the right reading.

| Rule | Removes | Hard or soft |
|---|---|---|
| Standalone lithium-ion is cargo-aircraft-only | any passenger belly rebooking | hard |
| Cargo not screened to passenger standard | belly rebooking until re-screened | hard until screened |
| Security chain broken by re-handling | everything, until a screening slot exists | soft, costs time |
| Active container endurance | the truck leg, when the clock is shorter than the route | hard |
| GDP lane qualification | reroute onto an unqualified lane without QA sign-off | hard |
| Temperature excursion window | letting it ride, and every slow option | hard for pharma |
| Advance cargo data not filed against the new carrier before loading | competitor rebooking against a tight cutoff | soft, data-work against a clock |
| Payload and aircraft type | belly rebooking for oversize built for a main deck | hard |
| Spend authority threshold | high-cost remedies after hours | soft, needs a second person |

The last one is the multi-human hook and is dealt with separately.

## What the agent learns from the declines

Structured decline reasons, each of which is information the agent did not have:

- a routing constraint it could not infer
- a per-customer floor, such as never offering do-nothing to this account
- an authority threshold, such as spend over a limit needing a duty manager after 22:00

The last becomes a standing rule. That is a policy a forwarder would genuinely set, which the
repricing scenario never quite justified.

## Why this scenario lands with the judges

One root cause, a blast radius, a triage queue, per-item remediation with a cost, partial
rollout, and a structured account of the declined remainder. That is an incident-response
postmortem. Platform engineers have lived one bad deploy, forty affected services, each fixed
differently, on a clock. No freight vocabulary is required: a flight was cancelled, 42 packages
were on it, here is the recovery plan, approve what you will pay for.

## What must not go in

**No China tariff content.** The lane is Frankfurt to Chicago, so China policy is not in frame,
and rates are moving weekly. Pulling it in would read as chasing topicality to exactly the
audience we need to convince. De minimis is stable enough for one dated sentence of context in a
written piece; nothing is built on it.

**No customs-refusal drama.** An EU export declaration is not tied to a flight. Re-routing to
another EU gateway is the designed-for case, not a re-declaration. The cost is re-handling,
re-manifesting and the screening queue. Say that instead.

## Verify before publishing anything

Four items rest on inference and one conversation settles each:

1. Real house-waybill count per consol, from the forwarding system.
2. A gateway lead confirming the ninety-minute triage as lived practice, not just structurally
   possible.
3. EU practice for one export reference split across two flights.
4. Whether recovery costs can be passed through, which is contract by contract.

## What changes in the build

The engine is untouched. Fixtures gain a consol, a flight, an SLA configuration and cargo flags.
Tools move from field mutation to remedy proposal. The panel gains a per-row recommendation with
its cost, and a blocked-option list carrying the rule that blocked it.
