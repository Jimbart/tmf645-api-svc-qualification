/* eslint-disable no-underscore-dangle */
import csq from '../../controllers/CheckServiceQualificationController';
import amsApi from '../../vendor_api/AmsApi';

test('Build request object for email attachment', async () => {
  const lpdsid = '2377066';
  const amsAddress = await amsApi.getAddressByLpdsId(lpdsid);
  const attachmentObject = csq._buildEmailAttachmentObject(amsAddress, lpdsid);

  const {
    GEO_LOCATIONID,
    GEO_STD_ADDRESS,
    GEO_STADDRESS,
    GEO_CITY,
    GEO_PROVINCE,
    GEO_POSTAL,
  } = attachmentObject;
  expect(GEO_LOCATIONID).toBe(lpdsid);
  expect(GEO_LOCATIONID).not.toBe('2377067');
  expect(GEO_STD_ADDRESS).toBe('253 ST PAUL STREET BURLINGTON ON L7R3J7 CAN');
  expect(GEO_STADDRESS).toBe('253 ST PAUL STREET');
  expect(GEO_CITY).toBe('BURLINGTON');
  expect(GEO_PROVINCE).toBe('ON');
  expect(GEO_POSTAL).toBe('L7R3J7');
});
