/* eslint-disable */
/**
 * The CheckServiceQualificationController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic reoutes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

import {} from 'dotenv/config';
import createDebug from 'debug';
import fs from 'fs';
import moment from 'moment';
import path from 'path';
import sgMail from '@sendgrid/mail';
import Controller from './Controller';
import service from '../services/CheckServiceQualificationService';
import URL from '../utils/enums/UrlEnum';
import FIRESTORE_DB from '../utils/enums/FirestoreEnum';
import STANDARD from '../utils/enums/StandardEnum';
import STATUS from '../utils/enums/StatusEnum';
import ERROR_MESSAGE from '../utils/enums/ErrorMessageEnum';
import ShawApi from '../vendor_api/ShawApi';
import BellApi from '../vendor_api/BellApi';
import amsApi from '../vendor_api/AmsApi';
import sendEmail from '../vendor_api/VendorEmail';
import checkServiceQualificationSchema from '../model/CheckServiceQualification';
import ADMIN from '../firestore/firestore-config';
import logger from '../logger';
import ExcelJs from 'exceljs';
import * as dbServer from '../dbServer';
import dbRepository from '../repository/DatabaseRepository';
import EmailSender from '../email/EmailSender';

const debug = createDebug(path.basename(__filename, '.js'));

sgMail.setApiKey(process.env.SENDGRID_API);

const generateServiceQualificationItem = (place, relatedPartyName) => {
  return {
    id: 0,
    state: 'inProgress',
    service: {
      place: [...place],
      relatedParty: {
        '@referredType': 'Organization',
        name: relatedPartyName,
        role: 'Partner',
        '@type': 'RelatedParty',
      },
      serviceSpecification: {
        name: 'Off_Net_Unmanaged',
        version: '1.0',
        id: '1',
        '@type': 'ServiceSpecification',
        href: 'http://placeholder/catalog/off-net/services/1',
      },
      serviceCharacteristic: [],
      serviceType: 'business',
    },
    qualificationResult: 'unqualified',
    expirationDate: moment().format(STANDARD.DATE_FORMAT),
  };
};

const _buildExternalApiRequestObject = (amsAddress) => {
  return {
    GEO_STADDRESS: `${amsAddress.Addresses[0].streetNumber} ${amsAddress.Addresses[0].streetName} ${amsAddress.Addresses[0].streetTypeSuffix}`,
    GEO_STNUMBER: amsAddress.Addresses[0].streetNumber,
    GEO_STNAME: amsAddress.Addresses[0].streetName,
    GEO_STTYPE: amsAddress.Addresses[0].streetTypeSuffix.substr(0, 2),
    GEO_COUNTRY: amsAddress.Addresses[0].country,
    GEO_CITY: amsAddress.Addresses[0].city,
    GEO_PROVINCE: amsAddress.Addresses[0].province,
    GEO_POSTAL: amsAddress.Addresses[0].postalCode,
  };
};

const _buildEmailAttachmentObject = (amsAddress, lpdsId) => {
  return {
    ID: 1,
    GEO_LOCATIONID: lpdsId,
    GEO_STD_ADDRESS: `${amsAddress.Addresses[0].streetNumber} ${amsAddress.Addresses[0].streetName} ${amsAddress.Addresses[0].streetTypeSuffix} ${amsAddress.Addresses[0].city} ${amsAddress.Addresses[0].province} ${amsAddress.Addresses[0].postalCode} ${amsAddress.Addresses[0].country}`,
    GEO_STADDRESS: `${amsAddress.Addresses[0].streetNumber} ${amsAddress.Addresses[0].streetName} ${amsAddress.Addresses[0].streetTypeSuffix}`,
    GEO_CITY: amsAddress.Addresses[0].city,
    GEO_PROVINCE: amsAddress.Addresses[0].province,
    GEO_POSTAL: amsAddress.Addresses[0].postalCode,
  };
};

const _sendEmailWithAttachment = async (
  requestId,
  newAmsMap,
  province,
  partnerNames
) => {
  const attachmentFilename = `${requestId}_${moment().format(
    'YYYYMMDD'
  )}_TELUS_HSIALOOKUP.xlsx`;
  const workbook = new ExcelJs.Workbook();
  const worksheet = workbook.addWorksheet(attachmentFilename);

  const attachmentHeader = Object.keys(newAmsMap);
  const attachmentValues = Object.values(newAmsMap);
  worksheet.addRow([...attachmentHeader, 'HSIAPROVIDER', 'SPEEDS 1']);
  worksheet.addRow(attachmentValues);
  await workbook.xlsx.writeFile(attachmentFilename);

  try {
    const attachment = fs.readFileSync(attachmentFilename).toString('base64');

    let partnerEmails = [];

    if (!partnerNames) {
      debug(`getting emails by province ${province}`);
      partnerEmails = await sendEmail(province);
    } else {
      debug('getting emails by parter name:', partnerNames);

      for (let partnerName of partnerNames) {
        const partnerEmail = await _getEmailsByPartnerName(partnerName);
        partnerEmails.push(...partnerEmail);
      }
    }

    debug('partnerEmails:', partnerEmails);
    const msg = {
      to: partnerEmails,
      from: URL.TELUS_EXCHANGE,
      subject: URL.EMAIL_SUBJECT,
      text: URL.EMAIL_TEXT,
      html: URL.EMAIL_HTML,

      attachments: [
        {
          content: attachment,
          filename: attachmentFilename,
          type: 'application/vnd.ms-excel',
          disposition: 'attachment',
        },
      ],
      mail_settings: {
        sandbox_mode: {
          enable: false,
        },
      },
    };

    const send = () => {
      sgMail.send(msg).catch((err) => {
        debug(`ERROR SENDING EMAIL WITH MESSAGE: ${err}`);
      });
    };

    // send();
    debug('EMAIL SENT!!!');
    return msg;
  } catch (err) {
    debug('sendEmailWithAttachment ERROR:', err.message);
  } finally {
    debug('DELETING LOCAL ATTACHMENT FILE...');
    fs.unlinkSync(attachmentFilename);
  }
};
const _doProcessShawApiRequest = async (address) => {
  const {
    GEO_STADDRESS,
    GEO_CITY,
    GEO_PROVINCE,
    GEO_COUNTRY,
    GEO_POSTAL,
  } = address;
  const addressRequest = [
    {
      'sel:Name': ['street'],
      'sel:Value': [GEO_STADDRESS],
    },
    {
      'sel:Name': ['city'],
      'sel:Value': [GEO_CITY],
    },
    {
      'sel:Name': ['state'],
      'sel:Value': [GEO_PROVINCE],
    },
    {
      'sel:Name': ['country'],
      'sel:Value': [GEO_COUNTRY],
    },
    {
      'sel:Name': ['zip'],
      'sel:Value': [GEO_POSTAL],
    },
  ];
  debug('CALLING SHAW API WITH ADDRESS REQUEST:', addressRequest);

  const shawApi = new ShawApi();
  const shawTariffsInfoResponse = await shawApi.getTariffInfo(addressRequest);
  return shawApi.getParsedTariffData(shawTariffsInfoResponse.body);
};

const _doProcessBellApiRequest = async (address) => {
  const {
    GEO_STNUMBER,
    GEO_STNAME,
    GEO_STTYPE,
    GEO_CITY,
    GEO_PROVINCE,
    GEO_POSTAL,
  } = address;
  const addressRequest = [
    {
      streetNumber: [GEO_STNUMBER],
      streetName: [GEO_STNAME],
      streetType: [GEO_STTYPE],
      municipalityCity: [GEO_CITY],
      provinceOrState: [GEO_PROVINCE],
      postalCode: [GEO_POSTAL],
    },
  ];
  debug('CALLING BELL API WITH ADDRESS REQUEST:', addressRequest);

  const bellApi = new BellApi();
  const presaleProducts = await bellApi.getPresaleProducts(addressRequest);
  return bellApi.getParsedPresaleProducts(presaleProducts.body);
};

const prepareBlankCsqFirestoreDoc = async () => {
  const preparedDoc = ADMIN.collection(FIRESTORE_DB.CSQ_SCHEMA);
  const doc = await preparedDoc.add({});

  return doc.id;
};

const _buildPlacesFromAmsAddress = (amsAddress, placeId) => {
  const places = amsAddress.Addresses.filter((address) => {
    return parseInt(address.referenceIds.LPDS_ID) === parseInt(placeId);
  }).map((data) => {
    const {
      streetNumber,
      streetName,
      streetTypeSuffix,
      city,
      province,
      postalCode,
      country,
    } = data;

    const place = {
      id: placeId,
      role: 'Service Qualification Place',
      streetNr: streetNumber,
      streetName,
      streetType: streetTypeSuffix,
      city,
      stateOrProvince: province,
      postcode: postalCode,
      country,
      '@type': 'GeographicAddress',
    };

    return place;
  });

  return places;
};

const _buildRelatedPartyObject = (partnerName) => {
  return {
    name: partnerName,
    role: 'Partner',
    '@type': 'RelatedParty',
    '@referredType': 'Organization',
  };
};

const _buildServiceCharacteristicObject = (serviceValue) => {
  return [...serviceValue];
};

const _findServiceQualItemByPlaceId = (serviceQualItem, placeId) => {
  return serviceQualItem.find((item) => {
    return item.service.place.find((place) => place.id === placeId);
  });
};

const _queryShawOfferinPartners = async (connection, querySelect) => {
  const partnerOffersQueryString = querySelect;

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line consistent-return
    connection.query(partnerOffersQueryString, (error, result) => {
      dbServer.close(connection);

      if (error) {
        return reject(error);
      }
      resolve(JSON.stringify(result));
    });
  });
};

const _handleShawTrueApitoDB = async (coax, fiber, province) => {
  let parsedResultDB = [];
  if (coax.toUpperCase() === fiber.toUpperCase()) {
    const connection = await dbServer.getConnection();
    const querySelect = `SELECT * FROM PARTNER_OFFERS WHERE PROVINCE_ABBREV = ${connection.escape(
      province
    )}AND PARTNER_OFFER_NAME LIKE 'Shaw%'`;
    const resultCoaxFiber = await _queryShawOfferinPartners(
      connection,
      querySelect
    );
    parsedResultDB.push(resultCoaxFiber);
  } else if (fiber.toUpperCase() === 'Y') {
    const connection = await dbServer.getConnection();
    const querySelect = `SELECT * FROM PARTNER_OFFERS WHERE PROVINCE_ABBREV = ${connection.escape(
      province
    )} AND TECHNOLOGY = ${connection.escape(
      'FIBER'
    )}AND PARTNER_OFFER_NAME LIKE 'Shaw%'`;
    const resultFiber = await _queryShawOfferinPartners(
      connection,
      querySelect
    );
    parsedResultDB.push(resultFiber);
  } else if (coax.toUpperCase() === 'Y') {
    const connection = await dbServer.getConnection();
    const querySelect = `SELECT * FROM PARTNER_OFFERS WHERE PROVINCE_ABBREV = ${connection.escape(
      province
    )} AND TECHNOLOGY = ${connection.escape(
      'COAX'
    )}AND PARTNER_OFFER_NAME LIKE 'Shaw%'`;
    const resultCoax = await _queryShawOfferinPartners(connection, querySelect);
    parsedResultDB.push(resultCoax);
  }

  const filterObject = JSON.parse(parsedResultDB);
  const objectAlter = filterObject.map((item) => {
    const container = {
      TELUS_OFFER_ID: item.TELUS_OFFER_ID,
      PARTNER_OFFER_NAME: item.PARTNER_OFFER_NAME,
      TELUS_OFFER_NAME: item.TELUS_OFFER_NAME,
      TECHNOLOGY: item.TECHNOLOGY,
      SPEED: item.SPEED,
      PARTNER_OFFER_STATUS: item.PARTNER_OFFER_STATUS,
      TELUS_OFFERING_CATEGORY: item.TELUS_OFFERING_CATEGORY,
      DL_SPEED: item.PO_DL_SPEED,
      UP_SPEED: item.PO_UL_SPEED,
      PARTNER_NAME: item.TELUS_PARTNER_ID,
      PARTNER_CONTACT_MODE: item.CONTACT_MODE,
    };
    return container;
  });
  return objectAlter;
};

const _getEmailsByPartnerName = async (partnerName) => {
  const connection = await dbServer.getConnection();
  const partnerEmailQueryString = `SELECT CONTACT_EMAIL FROM PARTNERS 
    WHERE UPPER(PARTNER_NAME) = UPPER(${connection.escape(partnerName)})`;

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line consistent-return
    connection.query(partnerEmailQueryString, (error, result) => {
      dbServer.close(connection);

      if (error) {
        reject(error);
      }
      try {
        const emails = result
          .map((data) => data.CONTACT_EMAIL)
          .filter((data) => data !== undefined);

        resolve(emails);
      } catch (error) {
        reject(error);
      }
    });
  });
};

const _revalidateStateAndResponseStatus = (validatedExistingItems) => {
  const {
    isInstantSync,
    isGoodExists,
    isExpiredExists,
    isNoFootprintWithAmsExists,
    isNoFootprintWithoutAmsExists,
  } = validatedExistingItems;

  debug(`isInstantSync: ${isInstantSync}`);
  debug(`isGoodExists: ${isGoodExists}`);
  debug(`isExpiredExists: ${isExpiredExists}`);
  debug(`isNoFootprintWithAmsExists: ${isNoFootprintWithAmsExists}`);
  debug(`isNoFootprintWithoutAmsExists: ${isNoFootprintWithoutAmsExists}`);

  const result = {
    state: 'done',
    responseStatus: 200,
  };

  // SEQUENCE: instantSync, good, expired, NF_W_AMS, NF_WO_AMS
  const truthTable = {
    done: [
      [true, true, false, false, false],
      [false, true, false, false, false],
      [true, false, false, true, false],
      [true, false, true, false, false],
      [false, true, false, false, true],
      [true, true, false, true, false],
      [true, true, false, false, true],
      [true, true, true, false, false],
      [true, true, true, true, false],
      [true, true, true, false, true],
      [true, true, false, true, true],
      [true, false, false, true, true],
    ],
    inProgress: [
      [false, false, false, true, false],
      [false, false, true, false, false],
      [false, true, false, true, false],
      [false, true, true, false, false],
      [false, true, true, false, true],
      [false, true, true, true, false],
      [false, true, false, true, true],
      [false, false, true, true, false],
    ],
    terminatedWithError: [
      [true, false, false, false, true],
      [false, false, false, false, true],
    ],
  };

  const validate = (array) => {
    const data = array.find((data) => {
      return (
        data.toString() === Object.values(validatedExistingItems).toString()
      );
    });

    return data !== undefined ? true : false;
  };

  const isDone = validate(truthTable.done);
  const isInProgress = validate(truthTable.inProgress);
  const isTerminatedWithError = validate(truthTable.terminatedWithError);

  debug(`isDone: ${isDone}`);
  debug(`isInProgress: ${isInProgress}`);
  debug(`isTerminatedWithError: ${isTerminatedWithError}`);

  if (isDone) {
    return result;
  } else if (isInProgress) {
    result.state = STATUS.IN_PROGRESS;
    result.responseStatus = 201;
  } else if (isTerminatedWithError) {
    result.state = STATUS.TERMINATED_WITH_ERROR;
    result.responseStatus = 400;
  }

  return result;
};

//For History LOg
const _amsToHistoryLog = async (amsAddress) => {
  const amsDetails = {
    streetNumber: amsAddress.Addresses[0].streetNumber,
    streetName: amsAddress.Addresses[0].streetName,
    streetTypeSuffix: amsAddress.Addresses[0].streetTypeSuffix,
    city: amsAddress.Addresses[0].city,
    province: amsAddress.Addresses[0].province,
    postalCode: amsAddress.Addresses[0].postalCode,
    country: amsAddress.Addresses[0].country,
    fullAddress:
      amsAddress.Addresses[0].streetNumber +
      ' ' +
      amsAddress.Addresses[0].streetName +
      ' ' +
      amsAddress.Addresses[0].streetTypeSuffix +
      ' ' +
      amsAddress.Addresses[0].city +
      ',' +
      ' ' +
      amsAddress.Addresses[0].province +
      ' ' +
      amsAddress.Addresses[0].postalCode +
      ' ' +
      amsAddress.Addresses[0].country,
    stAddress:
      amsAddress.Addresses[0].streetNumber +
      ' ' +
      amsAddress.Addresses[0].streetName +
      ' ' +
      amsAddress.Addresses[0].streetTypeSuffix,
  };

  return amsDetails;
};

const _buildCollectionExpireTrueToHistoryLog = async (
  requestFsId,
  expireMapAms,
  expireLog
) => {
  const endpointType = '/checkServiceQualification';
  const reqSubmittedOn = new Date(moment().toISOString());
  const partnerRespondedOn = new Date(moment().toISOString());
  const fullAddress = expireMapAms.fullAddress;
  const stAddress = expireMapAms.stAddress;
  const city = expireMapAms.city;
  const province = expireMapAms.province;
  const postalCode = expireMapAms.postalCode;
  const requestStatus = 200;

  const expireTrueHistoryLogBuilder = expireLog.map((item) => {
    const partnerOfferName = item.PARTNER_OFFER_NAME;
    const telusOfferNames = item.TELUS_OFFER_NAME;
    const telusOfferingCategory = item.TELUS_OFFERING_CATEGORY;
    const downloadSpeed = item.DL_SPEED.toString();
    const uploadSpeed = item.UP_SPEED.toString();
    const partnerName = item.PARTNER_NAME;
    const contactMode = item.PARTNER_CONTACT_MODE;

    const collection = [
      requestFsId,
      partnerOfferName,
      telusOfferNames,
      telusOfferingCategory,
      downloadSpeed,
      uploadSpeed,
      endpointType,
      partnerName,
      reqSubmittedOn,
      partnerRespondedOn,
      contactMode,
      fullAddress,
      stAddress,
      city,
      province,
      postalCode,
      requestStatus,
    ];

    return collection;
  });

  return expireTrueHistoryLogBuilder;
};

const _buildCollectionNoFootprintTrueToHistoryLog = async (
  requestFsId,
  NoFootprintMapAms,
  noFootPrintLog
) => {
  const endpointType = '/checkServiceQualification';
  const reqSubmittedOn = new Date(moment().toISOString());
  const partnerRespondedOn = new Date(moment().toISOString());
  const fullAddress = NoFootprintMapAms.fullAddress;
  const stAddress = NoFootprintMapAms.stAddress;
  const city = NoFootprintMapAms.city;
  const province = NoFootprintMapAms.province;
  const postalCode = NoFootprintMapAms.postalCode;
  const requestStatus = 200;

  const noFootprintTrueHistoryLogBuilder = noFootPrintLog.map((item) => {
    const partnerOfferName = item.PARTNER_OFFER_NAME;
    const telusOfferNames = item.TELUS_OFFER_NAME;
    const telusOfferingCategory = item.TELUS_OFFERING_CATEGORY;
    const downloadSpeed = item.DL_SPEED.toString();
    const uploadSpeed = item.UP_SPEED.toString();
    const partnerName = item.PARTNER_NAME;
    const contactMode = item.PARTNER_CONTACT_MODE;

    const collection = [
      requestFsId,
      partnerOfferName,
      telusOfferNames,
      telusOfferingCategory,
      downloadSpeed,
      uploadSpeed,
      endpointType,
      partnerName,
      reqSubmittedOn,
      partnerRespondedOn,
      contactMode,
      fullAddress,
      stAddress,
      city,
      province,
      postalCode,
      requestStatus,
    ];

    return collection;
  });

  return noFootprintTrueHistoryLogBuilder;
};

const createCheckServiceQualification = async (request, response) => {
  debug('csq controller trigger');
  try {
    response = await service.createCheckServiceQualification(request, response);
    const { statusCode, statusMessage } = response.json();

    debug(
      `CSQ RESPONSE FROM SERVICE: statusCode = ${statusCode} | statusMessage = ${statusMessage}`
    );
    if (statusCode !== 200 && statusCode !== 201) {
      const passMessageCode = [statusMessage, statusCode.toString()];
      await dbRepository.addError_Log(passMessageCode);
    }
    return response;
  } catch (error) {
    debug('CSQ CONTROLLER ERROR:', error.message);
  }

  // ===============================================================================================
  // let createdDocId;

  // try {
  //   createdDocId = await prepareBlankCsqFirestoreDoc();
  //   const result = await checkServiceQualificationSchema.validateAsync(
  //     request.body
  //   );

  //   const isInstantSync = result.instantSyncQualification;
  //   let serviceQualItemState = (!isInstantSync) ? STATUS.IN_PROGRESS : STATUS.DONE;
  //   let postResponseStatus = (!isInstantSync) ? 201 : 200;

  //   let expiredFootprints = [];

  //   let isGoodExists = false;
  //   let isExpiredExists = false;
  //   let isNoFootprintWithAmsExists = false;
  //   let isNoFootprintWithoutAmsExists = false;

  //   // Parse item and Lpds From Request Case 2/1  ***generate uuid ***
  //   const getRequestLpdsLookFootprint = async () => {
  //     const parseItemId = result.serviceQualificationItem;
  //     const mapItemId = parseItemId.map((row) => row.id);
  //     const iterItemId = mapItemId[Symbol.iterator]();

  //     let ctr = 0;
  //     global.finalResult = [];
  //     global.goodLpdsidFromFirestore = [];
  //     global.requestLpdsforExit = [];
  //     global.saveForPayload = [];
  //     global.expiredLpdsid = [];

  //     for (const itemId of iterItemId) {
  //       debug('item id', itemId);
  //       const parseLpdsId = result.serviceQualificationItem[ctr].service.place;
  //       const mapLpdsId = parseLpdsId.map((row) => row.id);
  //       const iteration = mapLpdsId[Symbol.iterator]();
  //       for (const requestLpdsId of iteration) {
  //         debug('parse lpds', requestLpdsId);
  //         global.requestLpdsforExit.push(requestLpdsId);
  //         // connecting to Firestore and Lookup FootPrint
  //         const fireDb = ADMIN.collection(FIRESTORE_DB.CSQ_SCHEMA);
  //         const queryFootprint = await fireDb
  //           .where('state', '==', 'done')
  //           .get();
  //         if (queryFootprint.empty) {
  //           debug('Firestore is empty');
  //           break;
  //         }
  //         queryFootprint.forEach((doc) => {
  //           const data = doc.data();
  //           const parseDoc = data.serviceQualificationItem;
  //           const mapDoc = parseDoc.map((row) => row.id);
  //           const iterDoc = mapDoc[Symbol.iterator]();
  //           let fctr = 0;
  //           for (const fireItemId of iterDoc) {
  //             debug('item id in firestore ', fireItemId);
  //             const fireParseLpdsId =
  //               data.serviceQualificationItem[fctr].service.place;
  //             const fireMapLpdsId = fireParseLpdsId.map((row) => row.id);
  //             const fireIteration = fireMapLpdsId[Symbol.iterator]();

  //             for (const fireLpdsId of fireIteration) {
  //               debug('parse lpds inside Firestore', fireLpdsId);
  //               debug('counter for item printing', fctr);
  //               const expiry =
  //                 data.serviceQualificationItem[fctr].expirationDate;
  //               // If request lpdsId exist in Firestore but Expire
  //               if (
  //                 requestLpdsId == fireLpdsId &&
  //                 moment(expiry).isBefore(moment())
  //               ) {
  //                 isExpiredExists = true;
  //                 // expired footprints from firestore
  //                 // update state and qualificationResult and push to finalResult
  //                 const expiredFootprint = data.serviceQualificationItem[fctr]
  //                 expiredFootprint.qualificationResult = STATUS.UNQUALIFIED
  //                 expiredFootprint.state = STATUS.IN_PROGRESS

  //                 expiredFootprints.push(expiredFootprint);
  //                 global.expiredLpdsid.push(requestLpdsId);
  //               }
  //               // if request lpdsId exist in firestore and Not Expire
  //               else if (
  //                 requestLpdsId == fireLpdsId &&
  //                 moment(expiry).isAfter(moment())
  //               ) {
  //                 isGoodExists = true;
  //                 global.saveForPayload.push(
  //                   data.serviceQualificationItem[fctr]
  //                 );
  //                 global.goodLpdsidFromFirestore.push(fireLpdsId);
  //                 // debug(data.serviceQualificationItem[fctr]);
  //               } else {
  //                 debug('Request LpdsId No Match in Firestore Loop');
  //               }
  //             }
  //             fctr++;
  //           }
  //         });
  //       } // end of loop lpds
  //       ctr++;
  //     } // end of item loop
  //   };
  //   /// Filter Collection -------Reg Flow /////////////
  //   await getRequestLpdsLookFootprint();
  //   debug('goodLpdsidFromFirestore', global.goodLpdsidFromFirestore);
  //   debug('requestLpdsforExit', global.requestLpdsforExit);
  //   debug('saveForPayload', global.saveForPayload);
  //   debug('expiredLpdsid', global.expiredLpdsid);

  //   // collection of good lpds_id parse from Firestore was set to unique
  //   const uniqueGoodLpdsFirestore = global.goodLpdsidFromFirestore.filter(
  //     (item, i, ar) => ar.indexOf(item) === i
  //   );
  //   debug('good lpds-id from firestore', uniqueGoodLpdsFirestore);

  //   /// / filter No FootPrint
  //   const first = global.requestLpdsforExit.filter(
  //     (x) => !global.goodLpdsidFromFirestore.map(Number).includes(x)
  //   );
  //   debug('first filter', first);
  //   debug('expired lpds', global.expiredLpdsid);
  //   const noFootPrint = first.filter(
  //     (x) => !global.expiredLpdsid.map(Number).includes(x)
  //   );
  //   debug('no footprint lpds id ', noFootPrint);

  //   // No Foot Print Found in Firestore
  //   global.mapNFAms = [];
  //   global.collectionNoFootprintTrueToHistoryLog = [];
  //   const noFootPrintFoundLpds = async () => {
  //     if (noFootPrint === undefined || noFootPrint.length == 0) {
  //       debug('all lpds id found in firestore');
  //     } else {
  //       const filterNo = noFootPrint[Symbol.iterator]();
  //       let noFootprintCounter = 0;

  //       for (const filterNoFootPrint of filterNo) {
  //         debug('on nofootprint query Ams using this lpdsId', filterNoFootPrint);

  //         const amsAddress = await amsApi.getAddressByLpdsId(filterNoFootPrint);
  //         debug('on nofootprint getAddressByLpdsId result: ', amsAddress);
  //         if (amsAddress !== undefined) {
  //           isNoFootprintWithAmsExists = true;
  //           // for external APIs (SHAW and BELL)
  //           global.external_api_address = _buildExternalApiRequestObject(amsAddress);
  //           debug('on nofootprint address request for external APIs:', global.external_api_address);
  //           // for email attachment
  //           global.add = _buildEmailAttachmentObject(amsAddress, filterNoFootPrint);
  //           debug('on nofootprint email attachment object:', global.add);

  //           const province = amsAddress.Addresses[0].province;
  //           debug('on nofootprint province:', province);

  //           const addCollect = ADMIN.collection('addressCollection').doc();
  //           await addCollect.set(global.add);

  //           // instantSyncQualification=False will send Email to Vendor - Filter by Province
  //           if (!isInstantSync) {

  //             // sending email
  //             // await _sendEmailWithAttachment(createdDocId, global.add, province);
  //             const offers = await dbRepository.queryGetAllPartnerOffersByProvince(province);
  //             const distinctPartners = new Set(JSON.parse(offers).map(data => data.TELUS_PARTNER_ID));

  //             // loop partnerIds to get offers
  //             for (let partnerId of distinctPartners) {
  //               // offerNames using partnerId
  //               const offerNames = JSON.parse(offers).map(offer => {
  //                 if (offer.TELUS_PARTNER_ID === partnerId) {
  //                   return offer.PARTNER_OFFER_NAME
  //                 }
  //               }).filter(data => data !== undefined);

  //               const recipient = JSON.parse(offers)
  //                 .find(offer => offer.TELUS_PARTNER_ID === partnerId);

  //               const attachmentData = {
  //                 ADDRESS: global.add.GEO_STD_ADDRESS,
  //                 OFFER_NAMES: offerNames,
  //                 LPDS_ID: filterNoFootPrint,
  //                 PARTNER_NAME: new String(recipient.PARTNER_NAME).toUpperCase(),
  //                 PROVINCE_ABBREV: new String(province).toUpperCase(),
  //               }

  //               const emailSender = new EmailSender(createdDocId, attachmentData);

  //               await emailSender.send(recipient.CONTACT_EMAIL);

  //               debug('on nofootprint, on email generate serviceQualification items')
  //               const places = _buildPlacesFromAmsAddress(amsAddress, filterNoFootPrint);
  //               const serviceQualItemOnEmail = generateServiceQualificationItem(places, new String(recipient.PARTNER_NAME).toUpperCase());
  //               global.finalResult.push(serviceQualItemOnEmail);
  //             }

  //           } else {
  //             let noFootprintPartnersData = [];
  //             // calling external APIs
  //             // if Province not equal to AB and BC, call SHAW API
  //             if (province !== 'AB' && province !== 'BC') {
  //               const tariffsInfo = await _doProcessShawApiRequest(global.external_api_address, province);
  //               if (tariffsInfo !== undefined || tariffsInfo.length !== 0) {

  //                 // THIS COMMENT IS FOR TESTING/CHANING Shaw offer values.
  //                 const samplex = tariffsInfo.map(param => {
  //                   if (param.Name[0] === 'Coax') {
  //                     param.Value[0] = 'None'
  //                   }
  //                   return param;
  //                 });
  //                 const samplez = tariffsInfo.map(params => {
  //                   if (params.Name[0] === 'Fiber') {
  //                     params.Value[0] = 'y'
  //                   }
  //                   return params;
  //                 });

  //                 const coax = tariffsInfo
  //                   .filter(data => data.Name[0] === 'Coax')
  //                   .map(data => {
  //                     return (!data.Value[0]) ? 'None' : data.Value[0];
  //                   }).join('');
  //                 debug('coax', coax)

  //                 const fiber = tariffsInfo
  //                   .filter(data => data.Name[0] === 'Fiber')
  //                   .map(data => {
  //                     return (!data.Value[0]) ? 'None' : data.Value[0];
  //                   }).join('');
  //                 debug('fiber', fiber)

  //                 let shawTechnologyResponse = 'unknown';
  //                 const locType = tariffsInfo.find(data => data.Name[0] === 'LocationType');
  //                 const locTypeValue = locType.Value;
  //                 debug('LocationType', locType, locTypeValue)
  //                 debug('Location Type Value', locTypeValue, province)

  //                 if (locTypeValue == 'Off-Net' && (fiber != 'None' || coax != 'None')) {
  //                   const callPartner_OfferDB = await _handleShawTrueApitoDB(coax, fiber, province)
  //                   debug('this is for No FootPrint query from DB', callPartner_OfferDB)
  //                   const shawOffer = callPartner_OfferDB.map(item => {

  //                     const container = {};
  //                     container.name = item.TELUS_OFFER_NAME
  //                     container.id = item.TELUS_OFFER_ID

  //                     container.value = {}

  //                     container.value.speed = item.SPEED
  //                     container.value.technology = item.TECHNOLOGY

  //                     return container;
  //                   })
  //                   noFootprintPartnersData.push({ name: 'Shaw', offer: shawOffer });

  //                   //Building Collection for No Footprint to History Logs
  //                   const parseNoFootprintAmsDetails = await _amsToHistoryLog(amsAddress);
  //                   global.mapNFAms.push(parseNoFootprintAmsDetails);
  //                   global.collectionNoFootprintTrueToHistoryLog.push(...callPartner_OfferDB);

  //                 }
  //                 else if (locTypeValue == 'On-Net') {
  //                   debug('This feature is under negotiation status!!!!!!!!!!')
  //                 }

  //               }
  //             }

  //             // // Call BELL API - uncomment this block if BELL is available
  //             // const bellPresaleProducts = await _doProcessBellApiRequest(global.external_api_address);

  //             // if (bellPresaleProducts !== undefined) {
  //             //   const downloadSpeed = bellPresaleProducts.find(prop => {
  //             //     return prop.name[0] === 'DownloadSpeed';
  //             //   });

  //             //   const uploadSpeed = bellPresaleProducts.find(prop => {
  //             //     return prop.name[0] === 'UploadSpeed';
  //             //   });

  //             //   noFootprintPartnersData.push({
  //             //     name: 'Bell',
  //             //     offer: {
  //             //       speed: `${downloadSpeed.value[0]}/${uploadSpeed.value[0]}`,
  //             //       technology: 'unknown'
  //             //     }
  //             //   });
  //             // } else {
  //             //   debug('NO BELL DATA FOUND');
  //             // }

  //             // build noFootprintItems
  //             let noFootprintItems = [];
  //             noFootprintPartnersData.forEach(partner => {

  //               // places - DONE
  //               const places = _buildPlacesFromAmsAddress(amsAddress, filterNoFootPrint);

  //               // build relatedParty object
  //               const relatedParty = _buildRelatedPartyObject(partner.name);

  //               // serviceCharacteristic object
  //               const serviceCharacteristic = _buildServiceCharacteristicObject(partner.offer);

  //               // serviceSpecification object
  //               const serviceSpecification = _findServiceQualItemByPlaceId(result.serviceQualificationItem,
  //                 filterNoFootPrint).service.serviceSpecification;

  //               // to be inserted in global.finalResult array
  //               const noFootPrintItem = {
  //                 id: (noFootprintCounter += 1),
  //                 state: serviceQualItemState,
  //                 service: {
  //                   serviceType: 'business',
  //                   place: places
  //                 },
  //                 relatedParty,
  //                 serviceCharacteristic,
  //                 serviceSpecification
  //               }

  //               debug('noFootPrintItem: ', noFootPrintItem);
  //               noFootprintItems.push(noFootPrintItem);
  //             });

  //             global.finalResult.push(...noFootprintItems);
  //           }
  //         } else {
  //           debug('on nofootprint without ams');
  //           isNoFootprintWithoutAmsExists = true;
  //         }
  //       } // end for loop
  //     } // end of No Footprint
  //   };

  //   await noFootPrintFoundLpds();
  //   // Expire LpdsID
  //   global.collectionExpiredTrueToHistoryLog = [];
  //   global.mapAms = [];
  //   const expiredFootPrintLpds = async () => {
  //     if (
  //       global.expiredLpdsid === undefined ||
  //       global.expiredLpdsid.length == 0
  //     ) {
  //       debug('No expire lpdsid found in firestore');
  //     } else {
  //       const filterX = global.expiredLpdsid[Symbol.iterator]();
  //       let expiredCounter = 0;

  //       for (const expiredLpdsId of filterX) {
  //         debug('expired lpds-id - >', expiredLpdsId);

  //         const amsAddress = await amsApi.getAddressByLpdsId(expiredLpdsId);

  //         if (amsAddress !== undefined) {

  //           // for external APIs (SHAW and BELL)
  //           global.external_api_address = _buildExternalApiRequestObject(amsAddress);
  //           debug('on expired address request for external APIs:', global.external_api_address);
  //           // for email attachment
  //           global.add = _buildEmailAttachmentObject(amsAddress, expiredLpdsId);
  //           debug('on expired email attachment object:', global.add);

  //           const province = amsAddress.Addresses[0].province;
  //           debug('on expired province:', province);

  //           let expiredPartnersData = [];

  //           if (!isInstantSync) {

  //             // const partnerNamesFromExpiredItems = expiredFootprints.map(data => {
  //             //   return data.service.relatedParty.name;
  //             // }).join('');

  //             // using partnerNames when relatedParty object exists in request object
  //             const partnerNamesFromRequestItems = result.serviceQualificationItem.map(data => {
  //               return data.service.relatedParty;
  //             }).filter(data => data != undefined)
  //               .flatMap(relatedParty => relatedParty)
  //               .map(relParty => relParty.name);

  //             debug('ON EXPIRED PROVINCE:', province);

  //             const offers = await dbRepository.queryGetAllPartnerOffersByProvince(province);
  //             const distinctPartners = new Set(JSON.parse(offers).map(data => data.TELUS_PARTNER_ID));

  //             // loop partnerIds to get offers
  //             for (let partnerId of distinctPartners) {

  //               // offerNames using partnerId
  //               const offerNames = JSON.parse(offers).map(offer => {
  //                 if (offer.TELUS_PARTNER_ID === partnerId) {
  //                   return offer.PARTNER_OFFER_NAME
  //                 }
  //               }).filter(data => data !== undefined);

  //               const recipient = JSON.parse(offers)
  //                 .find(offer => offer.TELUS_PARTNER_ID === partnerId);

  //               const attachmentData = {
  //                 ADDRESS: global.add.GEO_STD_ADDRESS,
  //                 OFFER_NAMES: offerNames,
  //                 LPDS_ID: expiredLpdsId,
  //                 PARTNER_NAME: new String(recipient.PARTNER_NAME).toUpperCase(),
  //                 PROVINCE_ABBREV: new String(province).toUpperCase(),
  //               }

  //               const emailSender = new EmailSender(createdDocId, attachmentData);

  //               if (partnerNamesFromRequestItems.length === 0) {

  //                 await emailSender.send(recipient.CONTACT_EMAIL);
  //               } else {

  //                 const emailsByPartners = await dbRepository.queryGetVendorEmailByPartnerNames([...new Set(partnerNamesFromRequestItems)]);
  //                 await emailSender.send(emailsByPartners);
  //               }

  //               // global.finalResult.push(...expiredFootprints);
  //               debug('on expired, on email generate serviceQualification items');
  //               const places = _buildPlacesFromAmsAddress(amsAddress, expiredLpdsId);
  //               const serviceQualItemOnEmail = generateServiceQualificationItem(places, new String(recipient.PARTNER_NAME).toUpperCase());
  //               global.finalResult.push(serviceQualItemOnEmail);
  //             }

  //           } else {

  //             // calling external APIs
  //             // if Province not equal to AB and BC, call SHAW API
  //             if (province !== 'AB' && province !== 'BC') {
  //               const tariffsInfo = await _doProcessShawApiRequest(global.external_api_address, province);
  //               if (tariffsInfo !== undefined || tariffsInfo.length !== 0) {

  //                 // THIS COMMENT IS FOR TESTING/CHANING Shaw offer values.
  //                 const sample = tariffsInfo.map(param => {
  //                   if (param.Name[0] === 'Coax') {
  //                     param.Value[0] = 'y'
  //                   }
  //                   return param;
  //                 });

  //                 const sample2 = tariffsInfo.map(params => {
  //                   if (params.Name[0] === 'Fiber') {
  //                     params.Value[0] = 'None'
  //                   }
  //                   return params;
  //                 });

  //                 const coax = tariffsInfo
  //                   .filter(data => data.Name[0] === 'Coax')
  //                   .map(data => {
  //                     return (!data.Value[0]) ? 'None' : data.Value[0];
  //                   }).join('');

  //                 debug('coax', coax)

  //                 const fiber = tariffsInfo
  //                   .filter(data => data.Name[0] === 'Fiber')
  //                   .map(data => {
  //                     return (!data.Value[0]) ? 'None' : data.Value[0];
  //                   }).join('');

  //                 debug('fiber', fiber)

  //                 let shawTechnologyResponse = 'unknown';
  //                 const locType = tariffsInfo.find(data => data.Name[0] === 'LocationType');
  //                 const locTypeValue = locType.Value;
  //                 debug('LocationType', locType, locTypeValue)
  //                 debug('Location Type Value', locTypeValue, province)
  //                 if (locTypeValue == 'Off-Net' && (fiber != 'None' || coax != 'None')) {
  //                   const callPartner_OfferDB = await _handleShawTrueApitoDB(coax, fiber, province)
  //                   debug('from DB', callPartner_OfferDB)
  //                   const shawOffer = callPartner_OfferDB.map(item => {

  //                     const container = {};
  //                     container.name = item.TELUS_OFFER_NAME
  //                     container.id = item.TELUS_OFFER_ID

  //                     container.value = {}

  //                     container.value.speed = item.SPEED
  //                     container.value.technology = item.TECHNOLOGY

  //                     return container;
  //                   })
  //                   expiredPartnersData.push({ name: 'Shaw', offer: shawOffer });

  //                   // building collection for Expire True to History LOg
  //                   const parseAmsDetails = await _amsToHistoryLog(amsAddress)
  //                   global.mapAms.push(parseAmsDetails)
  //                   global.collectionExpiredTrueToHistoryLog.push(...callPartner_OfferDB)

  //                 }
  //                 else if (locTypeValue == 'On-Net') {
  //                   debug('This feature is under negotiation status!!!')
  //                 }

  //               }
  //             }

  //             // // Call BELL API - uncomment this block if BELL is available
  //             // const bellPresaleProducts = await _doProcessBellApiRequest(global.external_api_address);

  //             // if (bellPresaleProducts !== undefined) {
  //             //   const downloadSpeed = bellPresaleProducts.find(prop => {
  //             //     return prop.name[0] === 'DownloadSpeed';
  //             //   });

  //             //   const uploadSpeed = bellPresaleProducts.find(prop => {
  //             //     return prop.name[0] === 'UploadSpeed';
  //             //   });

  //             //   expiredPartnersData.push({
  //             //     name: 'Bell',
  //             //     offer: {
  //             //       speed: `${downloadSpeed.value[0]}/${uploadSpeed.value[0]}`,
  //             //       technology: 'unknown'
  //             //     }
  //             //   });
  //             // } else {
  //             //   debug('NO BELL DATA FOUND');
  //             // }

  //             // build expiredItems

  //             let expiredItems = [];
  //             expiredPartnersData.forEach(partner => {

  //               // places - DONE
  //               const places = _buildPlacesFromAmsAddress(amsAddress, expiredLpdsId);

  //               // build relatedParty object
  //               const relatedParty = _buildRelatedPartyObject(partner.name);

  //               // serviceCharacteristic object
  //               const serviceCharacteristic = _buildServiceCharacteristicObject(partner.offer);

  //               // serviceSpecification object
  //               const serviceSpecification = _findServiceQualItemByPlaceId(result.serviceQualificationItem,
  //                 expiredLpdsId).service.serviceSpecification;

  //               // to be inserted in global.finalResult array
  //               const expiredItem = {
  //                 id: (expiredCounter += 1),
  //                 state: serviceQualItemState,
  //                 service: {
  //                   serviceType: 'business',
  //                   place: places
  //                 },
  //                 relatedParty,
  //                 serviceCharacteristic,
  //                 serviceSpecification
  //               }

  //               debug('expiredItem: ', expiredItem);
  //               expiredItems.push(expiredItem);
  //             });

  //             global.finalResult.push(...expiredItems);
  //           }
  //         }
  //       }
  //     }
  //   };

  //   await expiredFootPrintLpds();

  //   // printing good lpds
  //   const printResponse = () => {
  //     if (
  //       global.saveForPayload === undefined ||
  //       global.saveForPayload.length == 0
  //     ) {
  //       debug('no good lpds for this request');
  //     } else {
  //       const filterUniqueGoodLpdsFirestore = uniqueGoodLpdsFirestore
  //         .map(Number)
  //       [Symbol.iterator]();

  //       for (const filterReq of filterUniqueGoodLpdsFirestore) {
  //         debug(filterReq);
  //         const filter = global.saveForPayload[Symbol.iterator]();
  //         for (const filterResult of filter) {
  //           if (filterResult.service.place[0].id == filterReq) {
  //             debug('on good item lpds_id:', filterResult.service.place[0].id);
  //             global.finalResult.push(filterResult);
  //             break;
  //           }
  //         }
  //       }
  //     }
  //   };
  //   printResponse();

  //   /// / Start of payload compilation
  //   // recreate IDs
  //   debug('global.finalResult', global.finalResult);
  //   global.finalResult.forEach((item, index) => {
  //     item.id = index += 1;
  //   });

  //   const finalStateAndResponseStatus = _revalidateStateAndResponseStatus({
  //     isInstantSync,
  //     isGoodExists,
  //     isExpiredExists,
  //     isNoFootprintWithAmsExists,
  //     isNoFootprintWithoutAmsExists
  //   });

  //   debug(`finalStateAndResponseStatus:`, finalStateAndResponseStatus);
  //   serviceQualItemState = finalStateAndResponseStatus.state;
  //   postResponseStatus = finalStateAndResponseStatus.responseStatus;

  //   const firestoreFootprint = {
  //     serviceQualificationItem: global.finalResult,
  //   };

  //   const saveRef = ADMIN.collection(FIRESTORE_DB.CSQ_SCHEMA).doc(createdDocId);
  //   const payload = result;

  //   const payloadHeaders = {
  //     id: saveRef.id,
  //     href: `${URL.POST_CHECK_SERVICE_QUAL}/${saveRef.id}`,
  //     checkServiceQualificationDate: moment().format(STANDARD.DATE_FORMAT),
  //     effectiveQualificationDate: moment().format(STANDARD.DATE_FORMAT),
  //     state: serviceQualItemState
  //   };

  //   const saveCheckQualificationToFirestore = {
  //     ...payloadHeaders,
  //     ...payload,
  //     ...firestoreFootprint,
  //   };
  //   await saveRef.set(saveCheckQualificationToFirestore);

  //   response.status(postResponseStatus).json({ ...saveCheckQualificationToFirestore });

  //   if (postResponseStatus === 200) {

  //     // Building Collection Entry for History Log
  //     const collectionForReporting = [];
  //     const requestFsId = saveRef.id;

  //     if (global.mapNFAms === undefined || global.mapNFAms.length == 0) {
  //       debug('No Footprint-True in Ams to History Log ')

  //     } else {
  //       const NoFootprintMapAms = global.mapNFAms;
  //       const noFootPrintLog = global.collectionNoFootprintTrueToHistoryLog;
  //       const noFootPrintBuilder = await _buildCollectionNoFootprintTrueToHistoryLog(requestFsId, ...NoFootprintMapAms, noFootPrintLog)
  //       collectionForReporting.push(...noFootPrintBuilder);
  //     }

  //     if (global.mapAms === undefined || global.mapAms.length == 0) {
  //       debug('No Expire-True in Ams to History Log')
  //     } else {
  //       const expireMapAms = global.mapAms;
  //       const expireLog = global.collectionExpiredTrueToHistoryLog;
  //       const expireBuilder = await _buildCollectionExpireTrueToHistoryLog(requestFsId, ...expireMapAms, expireLog);
  //       collectionForReporting.push(...expireBuilder);
  //     }

  //     if (collectionForReporting === undefined || collectionForReporting.length == 0) {
  //       debug('Collection Entry to History Log is Empty');
  //     } else {
  //       debug('Array Entry to History Log', collectionForReporting)
  //       const entryCsqHisLogs = await dbRepository.addEntryToHistoryLog(collectionForReporting)
  //       debug('Response from Database Entry:', entryCsqHisLogs)
  //     }

  //   }

  // } catch (err) {
  //   logger.error(err.message);
  //   response.status(400).json({
  //     status: STATUS.TERMINATED_WITH_ERROR,
  //     message: err.message,
  //   });
  // } finally {
  //   const ref = ADMIN.collection(FIRESTORE_DB.CSQ_SCHEMA).doc(createdDocId);
  //   const doc = await ref.get();
  //   if (doc.exists && Object.entries(doc.data()).length === 0) {
  //     debug(`EMPTY DOCUMENT DELETED: ${createdDocId}`);
  //     ref.delete();
  //   }
  // }

  // await Controller.handleRequest(
  //   request,
  //   response,
  //   service.createCheckServiceQualification
  // );
};

const listCheckServiceQualification = async (request, response) => {
  Controller.handleRequest(
    request,
    response,
    service.listCheckServiceQualification
  );
};

// GET usecase 2
const retrieveCheckServiceQualification = async (request, response) => {
  try {
    response = await service.retrieveCheckServiceQualification(
      request,
      response
    );
    const { statusCode, statusMessage } = response.json();

    debug(
      `RESPONSE FROM SERVICE: statusCode = ${statusCode} | statusMessage = ${statusMessage}`
    );
    return response;
  } catch (error) {
    debug('CSQ CONTROLLER ERROR:', error.message);
  }

  // await Controller.handleRequest(
  //   request,
  //   response,
  //   service.retrieveCheckServiceQualification
  // );
};

export default {
  createCheckServiceQualification,
  listCheckServiceQualification,
  retrieveCheckServiceQualification,
  _sendEmailWithAttachment,
  _buildExternalApiRequestObject,
  _buildEmailAttachmentObject,
  _doProcessShawApiRequest,
  _doProcessBellApiRequest,
};
