// spec-derived.mjs, three weeks later.
//
// A session working on the "invalid time" error message added input validation.
// In isolation it is obviously correct: minutes in a day run 0–1439, so anything
// above that is bad input. The reviewer agreed. The tests passed.
//
// Nobody re-read §8 of the spec, which is four pages away and says:
//
//     endMinute: number;   // may exceed 1440 for overnight shifts
//
// This file is what drift looks like. It is not sloppy code. It is a locally
// sensible change that silently reverses a decision made for a reason.

export { detectConflicts } from './spec-derived.mjs';

const MAX_MINUTE = 1439;

export function validateShift(shift) {
  if (shift.startMinute < 0 || shift.startMinute > MAX_MINUTE) {
    throw new RangeError('startMinute must be between 0 and 1439');
  }
  if (shift.endMinute < 0 || shift.endMinute > MAX_MINUTE) {
    throw new RangeError('endMinute must be between 0 and 1439'); // ← the drift
  }
  return shift;
}

// What the save path does with a shift that fails validation: rejects it.
// The grid shows an error on the form and the shift is never stored.
export function save(shift, store) {
  try {
    validateShift(shift);
  } catch {
    return { saved: false, store };
  }
  return { saved: true, store: [...store, shift] };
}
