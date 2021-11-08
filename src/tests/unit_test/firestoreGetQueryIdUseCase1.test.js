/**
 * @jest-environment node
 */

/* eslint-disable jest/valid-expect-in-promise */
import connection from '../../firestore/firestore-config';
import FIRESTORE_DB from '../../utils/enums/FirestoreEnum';

test('Should GET equal response from request ID to test Firestore Connection in UseCase 1', async () => {
  const requestId = '3o9Pz0vsGrem14AvF5QJ';
  const getRef = connection.collection(FIRESTORE_DB.QSQ_SCHEMA).doc(requestId);

  await expect(getRef.get()).resolves.toEqual(
    expect.objectContaining({ id: requestId })
  );
  await expect(getRef.get()).resolves.not.toEqual(
    expect.objectContaining({ id: `${requestId}abc` })
  );
});
