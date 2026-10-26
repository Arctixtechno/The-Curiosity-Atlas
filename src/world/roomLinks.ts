import { rooms, startingRoomId } from '../rooms/registry.ts'
import { gameStore } from './store.ts'
import { travelTo } from './travel.ts'

// Links straight to a room: …/The-Curiosity-Atlas/#cafe opens in the café.
// The address follows you round the house, so copying it shares where you are.

function roomFromHash() {
  const id = decodeURIComponent(location.hash.slice(1))
  return id in rooms ? id : null
}

/** Goes to the room in the address, then keeps the address in step with the room you're in. Returns a cleanup. */
export function followRoomLinks() {
  const linked = roomFromHash()
  if (linked && linked !== gameStore.get().activeRoomId) void travelTo(linked)

  let shown = gameStore.get().activeRoomId
  const unsubscribe = gameStore.subscribe(() => {
    const room = gameStore.get().activeRoomId
    if (room === shown) return
    shown = room
    const hash = room === startingRoomId ? '' : `#${room}`
    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`)
  })
  // Editing the address by hand, or following another room link, moves you too.
  const onHashChange = () => {
    const room = roomFromHash() ?? startingRoomId
    if (room !== gameStore.get().activeRoomId) void travelTo(room)
  }
  window.addEventListener('hashchange', onHashChange)
  return () => {
    unsubscribe()
    window.removeEventListener('hashchange', onHashChange)
  }
}
