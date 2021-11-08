/**
 * Enum for status values.
 * @readonly
 * @enum {string}
 */
const STATUS = Object.freeze({
  ACKNOWLEDGED: 'Acknowledged',
  DONE: 'done',
  IN_PROGRESS: 'inProgress',
  TERMINATED_WITH_ERROR: 'terminatedWithError',
  SUCCESS: 'success',
  FAILED: 'failed',
  UNQUALIFIED: 'unqualified'
});

export default STATUS;
