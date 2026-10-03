// What the director said while putting a video together, as the app holds it (spec 7.6 and 7.7,
// «Монтаж в прямом эфире»). Four files and nothing else: the reading of the journal, everything a
// screen works out of an answer, the two helpers that turn a record into words, and the hook that
// reads one while it is still being written.
//
// Apart from the screens on purpose, the way `@/lib/montage/order` is apart from the order wizard:
// all of the arithmetic here runs without a phone, and the two screens of the milestone (the live
// one and the finished one) read the same journal through the same hook.

export * from './film';
export * from './live';
export * from './reading';
export * from './stage';
export * from './stages';
export * from './words';
