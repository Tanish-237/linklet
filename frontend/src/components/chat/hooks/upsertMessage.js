/**
 * Insert `incoming` into `prev`, replacing whichever entry actually represents
 * the same send instead of blindly appending. A message reaches the client
 * through two independent paths — the sender's own HTTP response and the
 * socket broadcast (the server emits to the whole chat room, sender included)
 * — and either can arrive first. Matching by `clientId` (present on both the
 * optimistic bubble and the persisted message) as well as `_id` means whichever
 * path lands second reconciles the existing bubble instead of adding a
 * duplicate — this is what actually stops "each message appears 2-3 times".
 */
export const upsertMessage = (prev, incoming) => {
  const matchesIncoming = (m) =>
    m._id === incoming._id ||
    (incoming.clientId && m.clientId && m.clientId === incoming.clientId);

  const existingIndex = prev.findIndex(matchesIncoming);
  if (existingIndex === -1) return [...prev, incoming];

  const next = prev.slice();
  next[existingIndex] = incoming;
  return next;
};
