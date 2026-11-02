import type { Plant } from './plant.ts'
import type { SiteBalance } from './site.ts'
import type { Task } from './ui.tsx'

// Targets for the plant manager: the margin, and keeping the tank farm and
// jetty running without losing money on either.

export const SITE_TASKS: Task<Plant, SiteBalance>[] = [
  {
    id: 'site-profit',
    title: 'Into the black',
    task: 'Run the whole site at a margin of $500k a day or more.',
    hint: 'The biggest lever is the petrol pool: off spec, every barrel sells as blendstock. Blend it on spec, then look at the sales table for what else is selling cheap.',
    met: (_, b) => b.margin >= 500_000,
  },
  {
    id: 'site-ten',
    title: 'Ten dollars a barrel',
    task: 'Make $10 or more for every barrel of crude.',
    hint: 'Fuel oil is the cheapest thing on the list: crack more of the gas oil (the tank will feel it), make octane in the isomerisation and alkylation units so the blenders can use cheaper components, and think about which crude you buy.',
    met: (_, b) => b.perBarrel >= 10,
  },
  {
    id: 'site-week',
    title: 'A quiet week',
    task: 'Run the tank farm for 7 days without the plant shutting down or a tank topping out.',
    hint: 'Watch the days of cover on every tank. The standing order looks after crude if you leave it on; products need ships booked before their tanks fill.',
    met: (p) => p.tanks.day >= 7 - 1e-6 && p.tanks.ledger.lost === 0 && p.tanks.ledger.distressed === 0,
  },
  {
    id: 'site-month',
    title: 'A clean month',
    task: 'Run 30 days with no shutdown, no tank-top sales and no demurrage.',
    hint: 'One berth means ships queue. Spread the bookings out, and book a product ship only when its tank has a cargo to give, or it will wait alongside on demurrage.',
    met: (p) => p.tanks.day >= 30 - 1e-6 && p.tanks.ledger.lost === 0 && p.tanks.ledger.distressed === 0 && p.tanks.ledger.demurrage === 0,
  },
]
