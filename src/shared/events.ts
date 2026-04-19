export type RuntimeEvent =
  | { kind: 'sessionStart'; simTime: number }
  | { kind: 'sessionStop'; simTime: number }
  | { kind: 'encounterStart'; simTime: number }
  | { kind: 'encounterEnd'; simTime: number }
  | { kind: 'pause'; simTime: number }
  | { kind: 'resume'; simTime: number };
