/**
 * Enum for Cloud Firestore variables.
 * @readonly
 * @enum {string}
 */
const FIRESTORE_DB = Object.freeze({
  CSQ_SCHEMA: 'checkServiceQualification',
  QSQ_SCHEMA: 'queryServiceQualification',
  EMAIL_SCHEMA: 'emailStatus',
  ASYNC_FALSE: 'syncFalse',
  // for email attachment
  ADDRESS_COLLECTION: 'addressCollection',
});

export default FIRESTORE_DB;
