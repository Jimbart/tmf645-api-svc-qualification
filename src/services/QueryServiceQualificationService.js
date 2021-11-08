/* eslint-disable no-unused-vars */

import Service from './Service';
import createDebug from 'debug';
import moment from 'moment';
import path from 'path';
import URL from '../utils/enums/UrlEnum';
import STATUS from '../utils/enums/StatusEnum';
import STANDARD from '../utils/enums/StandardEnum';
import ERROR_MESSAGE from '../utils/enums/ErrorMessageEnum';
import queryServiceQualificationSchema from '../model/QueryServiceQualification';
import amsApi from '../vendor_api/AmsApi';
import FIRESTORE_ENUM from '../utils/enums/FirestoreEnum';
import firestoreRepository from '../repository/FirestoreRepository';
import firestoreConfig from '../firestore/firestore-config';
import qsqAbstractService from './QsqAbstractService';
import entryToHistoryLog from '../repository/DatabaseRepository';
import dbRepository from '../repository/DatabaseRepository';

const debug = createDebug(path.basename(__filename, '.js'));

/**
 * Creates a QueryServiceQualification
 * This operation creates a QueryServiceQualification entity.
 *
 * queryServiceQualification QueryServiceQualificationCreate The QueryServiceQualification to be created
 * returns CheckServiceQualification
 * */
const createQueryServiceQualification = async (request, response) => {
  try {
    const validate = await queryServiceQualificationSchema.validateAsync(
      request.body
    );

    // Parse lpdsid from POST  request
    const getReqLpdsid = validate.searchCriteria.service.place;
    const getLpdsId = getReqLpdsid.map((row) => row.id);
    const iteration = getLpdsId[Symbol.iterator]();
    const saveRefs = firestoreRepository.getFirestoreSchemaRefs(
      FIRESTORE_ENUM.QSQ_SCHEMA
    );
    const payloads = validate;

    const serviceQualificationItem = [];
    const collectionForReporting = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const requestLpdsId of iteration) {
      debug('request lpds from post', requestLpdsId);
      // eslint-disable-next-line no-await-in-loop
      const getAddressInAms = await amsApi.getAddressByLpdsId(requestLpdsId);

      if (getAddressInAms === undefined) {
        debug(`${ERROR_MESSAGE.LPDS_ID_NOT_FOUND} -> ${requestLpdsId}`);
        qsqAbstractService.removeBadPlaceRequest(validate, requestLpdsId);
        debug(`Place request delete with LPDS_ID: ${requestLpdsId}`);
      } else {
        const provinceAbbrevWithPlaces = qsqAbstractService.mapProvincesAbbrevWithPlaces(
          getAddressInAms,
          validate.searchCriteria.service.place,
          requestLpdsId
        );

        debug('Address from AMS ', JSON.stringify(...provinceAbbrevWithPlaces));
        const str = JSON.stringify(provinceAbbrevWithPlaces);
        const parsed = JSON.parse(str);
        const getAbbrev = parsed.map((row) => row.abbrev)[0];

        const getstreetNr = parsed.map((row) => row.places[0].streetNr);
        const getstreetName = parsed.map((row) => row.places[0].streetName);
        const getstreetType = parsed.map((row) => row.places[0].streetType);
        const getCity = parsed.map((row) => row.places[0].city);
        const getPostcode = parsed.map((row) => row.places[0].postcode);
        const getCountry = parsed.map((row) => row.places[0].country);

        const fullAddress =
          getstreetNr +
          ' ' +
          getstreetName +
          ' ' +
          getstreetType +
          ' ' +
          getCity +
          ', ' +
          getAbbrev +
          ' ' +
          getPostcode +
          ' ' +
          getCountry;
        const getDBdetails = await qsqAbstractService.queryGetAllPartnerOffersByProvince(
          getAbbrev
        );

        const requestID = saveRefs.id;
        JSON.parse(getDBdetails).forEach((row) => {
          const partnerOfferName = row.PARTNER_OFFER_NAME;
          const telusOfferNames = row.TELUS_OFFER_NAME;
          const telusOfferingCategory = row.TELUS_OFFERING_CATEGORY;
          const downloadSpeed = row.PO_DL_SPEED.toString();
          const uploadSpeed = row.PO_UL_SPEED.toString();
          const partnerName = row.TELUS_PARTNER_ID;
          const contactMode = row.CONTACT_MODE;
          const endpointType = '/queryServiceQualification';
          const reqSubmittedOn = new Date(moment().toISOString());
          const partnerRespondedOn = new Date(moment().toISOString());
          const stAddress =
            getstreetNr + ' ' + getstreetName + ' ' + getstreetType;
          const city = getCity + '';
          const partnerProv = getAbbrev + '';
          const postalCode = getPostcode + '';
          const requestStatus = 200;
          const collectionColumn = [
            requestID,
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
            partnerProv,
            postalCode,
            requestStatus,
          ];

          collectionForReporting.push(collectionColumn);
        });

        // eslint-disable-next-line no-await-in-loop
        const parsedServiceQualificationItem = await qsqAbstractService.getAllParsedServiceQualItems(
          provinceAbbrevWithPlaces
        );
        const parseData = JSON.parse(
          JSON.stringify(parsedServiceQualificationItem)
        );

        serviceQualificationItem.push(...parseData);
      }
    }

    // generate response headers
    const payloadHeaders = {
      id: saveRefs.id,
      href: `${URL.POST_QUERY_SERVICE_QUAL}/${saveRefs.id}`,
      queryServiceQualificationDate: moment().format(STANDARD.DATE_FORMAT),
      effectiveQualificationDate: moment().format(STANDARD.DATE_FORMAT),
      state: STATUS.DONE,
    };

    /// save data to Firestore
    const saveQueryToFirestore = {
      ...payloadHeaders,
      ...payloads,
      serviceQualificationItem,
    };

    await saveRefs.set(saveQueryToFirestore);

    response.status(200).json({ ...saveQueryToFirestore });
    if (serviceQualificationItem.length !== 0) {
      debug('Offers to save in History Log', ...collectionForReporting);
      const entryResult = await entryToHistoryLog.addEntryToHistoryLog(
        collectionForReporting
      );
      debug('Saving history logs result:', entryResult);
    }
  } catch (err) {
    const passMessageCode = [err.message, '400'];
    await dbRepository.addError_Log(passMessageCode);

    response.status(400).json({
      status: STATUS.TERMINATED_WITH_ERROR,
      message: err.message,
    });
  }

  return response;
};

/**
 * List or find QueryServiceQualification objects
 * This operation list or find QueryServiceQualification entities
 *
 * fields String Comma-separated properties to be provided in response (optional)
 * offset Integer Requested index for start of resources to be provided in response (optional)
 * limit Integer Requested number of resources to be provided in response (optional)
 * returns List
 * */
const listQueryServiceQualification = ({ fields, offset, limit }) =>
  new Promise((resolve, reject) => {
    try {
      resolve(
        Service.successResponse({
          fields,
          offset,
          limit,
        })
      );
    } catch (e) {
      reject(
        Service.rejectResponse(e.message || 'Invalid input', e.status || 405)
      );
    }
  });
/**
 * Retrieves a QueryServiceQualification by ID
 * This operation retrieves a QueryServiceQualification entity. Attribute selection is enabled for all first level attributes.
 *
 * id String Identifier of the QueryServiceQualification
 * fields String Comma-separated properties to provide in response (optional)
 * returns QueryServiceQualification
 * */
const retrieveQueryServiceQualification = async (request, response) => {
  try {
    let { doc } = request.params;
    const getRef = firestoreConfig
      .collection(FIRESTORE_ENUM.QSQ_SCHEMA)
      .doc(doc);

    const result = await getRef.get();
    if (!result.exists) {
      return response.status(404).json({
        status: STATUS.FAILED,
        message: `${ERROR_MESSAGE.NO_SERVICE_QUAL_FOUND} with DOC ID: ${doc}`,
      });
    }

    response.status(200).json({
      ...result.data(),
    });
  } catch (err) {
    response.status(400).json({
      status: STATUS.TERMINATED_WITH_ERROR,
      message: err.message,
    });
  }

  return response;
};
export default {
  createQueryServiceQualification,
  listQueryServiceQualification,
  retrieveQueryServiceQualification,
};
