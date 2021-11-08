import firestoreConfig from '../firestore/firestore-config';
import createDebug from 'debug';
import path from 'path';
import FIRESTORE_ENUM from '../utils/enums/FirestoreEnum';
import STATUS from '../utils/enums/StatusEnum';
import STANDARD from '../utils/enums/StandardEnum';
import moment from 'moment';
import admin from 'firebase-admin';

const debug = createDebug(path.basename(__filename, '.js'));

const getFirestoreSchemaRefs = (schemaName) => {
  return firestoreConfig.collection(schemaName).doc();
};

const addBlankFirestoreDoc = async (schemaName) => {
  const preparedDoc = firestoreConfig.collection(schemaName);
  const doc = await preparedDoc.add({});
  debug(`empty document created with id: ${doc.id}`);
  return doc.id;
};

const deleteBlankFirestoreDoc = async (schemaName, docId) => {
  const ref = firestoreConfig.collection(schemaName).doc(docId);
  const doc = await ref.get();
  if (doc.exists && Object.entries(doc.data()).length === 0) {
    debug(`EMPTY DOCUMENT DELETED: ${docId}`);
    ref.delete();
  }

  return true;
};

const getEmailStatusPendingLpdsIds = async (lpdsId) => {
  return await firestoreConfig
    .collection(FIRESTORE_ENUM.EMAIL_SCHEMA)
    .where('lpdsId', '==', lpdsId)
    .where('email_inProgress', '==', STATUS.IN_PROGRESS)
    .get();
};

const addLpdsAsPendingEmail = async (lpdsId) => {
  debug('adding lpds_id as email pending status:', lpdsId);
  await firestoreConfig
    .collection(FIRESTORE_ENUM.EMAIL_SCHEMA)
    .doc()
    .set({
      lpdsId: lpdsId,
      email_inProgress: STATUS.IN_PROGRESS,
      email_sent: moment().format(STANDARD.DATE_FORMAT),
      request_docId: [],
    });
};

const updateReqDocIdsEmailStatusDoc = async (documentId, docId) => {
  await firestoreConfig
    .collection(FIRESTORE_ENUM.EMAIL_SCHEMA)
    .doc(documentId)
    .update({
      request_docId: admin.firestore.FieldValue.arrayUnion(docId),
    });
};

const addEntryAsyncFalse = async (
  isProvideAlternative,
  mapIdandRelatedEp,
  createdDocId,
  lpdsIdFromRequestItems
) => {
  debug('adding lpds_id as entry in asycFalse:');
  await firestoreConfig
    .collection(FIRESTORE_ENUM.ASYNC_FALSE)
    .doc()
    .set({
      timestamp: moment().format(STANDARD.DATE_FORMAT),
      fsDocumentId: createdDocId,
      provideAlternative: isProvideAlternative,
      lpdsIdPartner: mapIdandRelatedEp,
      lpdsIdAll: lpdsIdFromRequestItems,
      state: 'notStarted',
    });
};

const getFootprintSyncFalse = async () => {
  return await firestoreConfig
    .collection(FIRESTORE_ENUM.CSQ_SCHEMA)
    .where('state', '==', 'done')
    .orderBy('effectiveQualificationDate', 'desc')
    .get();
};

export default {
  getFirestoreSchemaRefs,
  addBlankFirestoreDoc,
  deleteBlankFirestoreDoc,
  getEmailStatusPendingLpdsIds,
  addLpdsAsPendingEmail,
  updateReqDocIdsEmailStatusDoc,
  addEntryAsyncFalse,
  getFootprintSyncFalse,
};
