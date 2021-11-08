import createDebug from 'debug';
import path from 'path';
import STATUS from '../utils/enums/StatusEnum';
import amsApi from '../vendor_api/AmsApi';
import dbRepository from '../repository/DatabaseRepository';
import ShawApi from '../vendor_api/ShawApi';
import BellApi from '../vendor_api/BellApi';
import ADMIN from '../firestore/firestore-config';
import * as dbServer from '../dbServer';
import moment from 'moment';
import STANDARD from '../utils/enums/StandardEnum';
import csqAbtractService from '../services/CsqAbstractService';
import fs from 'fs';
import firestoreConfig from '../firestore/firestore-config';
import firestoreRepository from '../repository/FirestoreRepository';
import FIRESTORE_ENUM from '../utils/enums/FirestoreEnum';
import csqExpiredItemsProcessor from '../services/CsqExpiredItemsProcessor';
import URL from '../utils/enums/UrlEnum';
import AddressStringBuilder from '../utils/AddressStringBuilder';

const debug = createDebug(path.basename(__filename, '.js'));

// private functions here
const buildNoAmsItem = (lpds) => {
  const noAmsItem = {
    id: 1,
    expirationDate: moment().format(STANDARD.DATE_FORMAT),
    state: 'terminatedWithError',
    qualificationResult: 'unqualified',
    eligibilityunavailabilityreason: [
      {
        code: '009',
        label: 'LPDS_ID not found in AMS API.',
      },
    ],
    service: {
      serviceType: 'business',
      place: [
        {
          id: lpds,
        },
      ],
      relatedParty: {},
      serviceCharacteristic: [],
      serviceSpecification: {
        id: 1,
        href:
          'http://placeholder/off-net/serviceQualificationManagement/v4/ServiceSpecification/1',
        name: 'Off_Net_Unmanaged',
        version: '1.0',
        '@type': 'ServiceSpecification',
      },
    },
  };
  return noAmsItem;
};

// bug in related party name

const getFindPartnerInMulitipleSpecifiedEP = (
  nfLpdsID,
  lpdsIdFromRequestItems,
  partnerNamesFromRequestItems
) => {
  const specifiedPartnerName = [];
  lpdsIdFromRequestItems.map(function (item, index) {
    const sameIndex = {
      lpds: item,
      partner: partnerNamesFromRequestItems[index],
    };
    console.log(sameIndex);
    if (sameIndex.lpds == nfLpdsID) {
      specifiedPartnerName.push(sameIndex.partner);
    }
  });
  return specifiedPartnerName;
};

// Rogers
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const delay = async () => {
  console.log('delay 5 seconds...');
  await sleep(5000);
};

const _doProcessBellApiRequest = async (address) => {
  try {
    const {
      GEO_STNUMBER,
      GEO_STNAME,
      GEO_ST_TYPE_PREFIX,
      GEO_CITY,
      GEO_PROVINCE,
      GEO_POSTAL,
    } = address;
    const addressRequest = [
      {
        streetNumber: [GEO_STNUMBER],
        streetName: [GEO_STNAME],
        streetType: [],
        municipalityCity: [GEO_CITY],
        provinceOrState: [GEO_PROVINCE],
        postalCode: [GEO_POSTAL],
      },
    ];
    debug('CALLING BELL API WITH ADDRESS REQUEST:', addressRequest);

    const bellApi = new BellApi();
    const presaleProducts = await bellApi.getPresaleProducts(addressRequest);

    return bellApi.getParsedPresaleProducts(presaleProducts.body);
  } catch (error) {
    debug('something went wrong', error);
    return false;
  }
};

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

const _findServiceQualItemByPlaceId = (serviceQualItem, placeId) => {
  return serviceQualItem.find((item) => {
    return item.service.place.find(
      (place) => place.id.toString() === placeId.toString()
    );
  });
};

const _buildRelatedPartyObject = (partnerName) => {
  return {
    name: partnerName,
    role: 'Partner',
    '@type': 'RelatedParty',
    '@referredType': 'Organization',
  };
};

const identifyQualificationResult = (serviceCharacteristic) => {
  if (serviceCharacteristic.length !== 0) {
    const qualResult = 'qualified';
    return qualResult;
  } else {
    const qualResult = 'unqualified';
    return qualResult;
  }
};

//places for Email InstantSynch_false

const _buildPlacesFromAmsAddressFalse = (amsAddress, placeId) => {
  const places = amsAddress.Addresses.filter((address) => {
    return parseInt(address.referenceIds.LPDS_ID) === parseInt(placeId);
  }).map((data) => {
    const {
      streetNumber,
      streetName,
      streetTypeSuffix,
      streetTypePrefix,
      city,
      province,
      postalCode,
      country,
    } = data;

    const addressBuilder = new AddressStringBuilder();
    addressBuilder
      .setName('streetType')
      .setValue(streetTypeSuffix)
      .setAlternativeValue(streetTypePrefix)
      .orElse('');
    addressBuilder.build();

    const place = {
      id: placeId,
      role: 'emailProcessor_inProgess',
      streetNr: streetNumber,
      streetName,
      streetType: addressBuilder.getAddress().streetType,
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

const getStreetDir = (dirPrefix, dirSuffix) => {
  if (dirPrefix == null && dirSuffix == null) {
    const streetDir = '';
    return streetDir;
  } else if (dirSuffix != null && dirPrefix == null) {
    return dirSuffix;
  } else if (dirPrefix != null && dirSuffix == null) {
    return dirPrefix;
  }
};

const _buildPlacesFromAmsAddress = (amsAddress, placeId) => {
  const places = amsAddress.Addresses.filter((address) => {
    return parseInt(address.referenceIds.LPDS_ID) === parseInt(placeId);
  }).map((data) => {
    const {
      unit,
      streetNumber,
      streetName,
      dirPrefix,
      dirSuffix,
      streetTypeSuffix,
      streetTypePrefix,
      city,
      province,
      postalCode,
      country,
    } = data;

    const addressBuilder = new AddressStringBuilder();
    addressBuilder
      .setName('streetType')
      .setValue(streetTypeSuffix)
      .setAlternativeValue(streetTypePrefix)
      .orElse('');
    addressBuilder.build();
    const manageUnit = unit == null ? '' : unit;
    const manageStreetDir = getStreetDir(dirPrefix, dirSuffix);
    const place = {
      unit: manageUnit,
      id: placeId,
      role: 'Service Qualification Place',
      streetNr: streetNumber,
      streetName,
      streetDir: manageStreetDir,
      streetType: addressBuilder.getAddress().streetType,
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

const buildOnNetPlaces = (getOnnet, nfLpdsID) => {
  const objectAlter = getOnnet.map((item) => {
    const place = {
      id: nfLpdsID,
      role: 'Service Qualification Place',
      streetNr: item.GEO_ST_NUMBER,
      streetName: item.GEO_ST_NAME,
      streetType: '',
      city: item.GEO_CITY,
      stateOrProvince: item.GEO_PROVINCE,
      postcode: item.GEO_POSTAL_CODE,
      country: 'CAN',
      '@type': 'GeographicAddress',
    };

    return place;
  });
  return objectAlter;
};

const shawExpirydate = (shawOffer, addDuration) => {
  if (shawOffer.length !== 0) {
    const newExpiredate = moment()
      .add(addDuration, 'days')
      .format(STANDARD.DATE_FORMAT);
    return newExpiredate;
  } else {
    const newExpiredate = '';
    return newExpiredate;
  }
};

//Bell
const getBuildBellOffer = (bellOffer) => {
  const serviceCharacteristic = [];
  const bell = bellOffer.map((item) => {
    const Offer = {
      id: item.TELUS_OFFER_ID,
      name: item.PARTNER_OFFER_NAME,
      value: {
        speed: item.SPEED,
        technology: item.TECHNOLOGY,
      },
    };
    serviceCharacteristic.push(Offer);
  });
  return serviceCharacteristic;
};

const bellExpiry = (duration, offer) => {
  if (offer.length !== 0) {
    const newExpiredate = moment()
      .add(duration, 'days')
      .format(STANDARD.DATE_FORMAT);
    return newExpiredate;
  } else {
    const newExpiredate = '';
    return newExpiredate;
  }
};

// CR55
const buildServiceCharCr55No = (grabPartnerOfferN) => {
  const serviceCharacteristic = [];
  const cr55 = grabPartnerOfferN.map((item) => {
    const Offer = {
      id: item.TELUS_OFFER_ID,
      name: item.PARTNER_OFFER_NAME,
      value: {
        speed: item.SPEED,
        technology: item.TECHNOLOGY,
      },
    };
    serviceCharacteristic.push(Offer);
  });
  return serviceCharacteristic;
};

// Cr69

const formNoFootPrintItem = (
  itemId,
  partnerCode,
  partnerDuration,
  serviceQualItemState,
  qualificationResult,
  places,
  relatedParty,
  serviceCharacteristic,
  serviceSpecification
) => {
  if (partnerCode == '006') {
    const item = {
      id: itemId,
      expirationDate: partnerDuration,
      state: 'terminatedWithError',
      qualificationResult: qualificationResult,
      eligibilityunavailabilityreason: [
        {
          code: '006',
          label: 'Error detected on Partner side API. Please retry.',
        },
      ],
      service: {
        serviceType: 'business',
        place: places,
        relatedParty,
        serviceCharacteristic,
        serviceSpecification,
      },
    };
    return item;
  } else if (partnerCode == '007') {
    const item = {
      id: itemId,
      expirationDate: partnerDuration,
      state: 'done',
      qualificationResult: qualificationResult,
      eligibilityunavailabilityreason: [
        {
          code: '007',
          label: 'No Offers.',
        },
      ],
      service: {
        serviceType: 'business',
        place: places,
        relatedParty,
        serviceCharacteristic,
        serviceSpecification,
      },
    };
    return item;
  } else {
    const item = {
      id: itemId,
      expirationDate: partnerDuration,
      state: serviceQualItemState,
      qualificationResult: qualificationResult,
      service: {
        serviceType: 'business',
        place: places,
        relatedParty,
        serviceCharacteristic,
        serviceSpecification,
      },
    };
    return item;
  }
};

const formNoFootPrintItemFalse = (
  partnerCode,
  partnerDuration,
  qualificationResultF,
  places,
  relatedParty,
  serviceCharacteristic,
  serviceSpecification
) => {
  if (partnerCode == '006') {
    const item = {
      expirationDate: partnerDuration,
      state: 'terminatedWithError',
      qualificationResult: qualificationResultF,
      eligibilityunavailabilityreason: [
        {
          code: '006',
          label: 'Error detected on Partner side API. Please retry.',
        },
      ],
      service: {
        serviceType: 'business',
        place: places,
        relatedParty,
        serviceCharacteristic,
        serviceSpecification,
      },
    };
    return item;
  } else if (partnerCode == '007') {
    const item = {
      expirationDate: partnerDuration,
      state: 'done',
      qualificationResult: qualificationResultF,
      eligibilityunavailabilityreason: [
        {
          code: '007',
          label: 'No Offers.',
        },
      ],
      service: {
        serviceType: 'business',
        place: places,
        relatedParty,
        serviceCharacteristic,
        serviceSpecification,
      },
    };
    return item;
  } else {
    const item = {
      expirationDate: partnerDuration,
      state: 'done',
      qualificationResult: qualificationResultF,
      service: {
        serviceType: 'business',
        place: places,
        relatedParty,
        serviceCharacteristic,
        serviceSpecification,
      },
    };
    return item;
  }
};

//Videotron

const determineExpiry = (addDuration, videotronOffer) => {
  if (videotronOffer.length !== 0) {
    const newExpiredate = moment()
      .add(addDuration, 'days')
      .format(STANDARD.DATE_FORMAT);
    return newExpiredate;
  } else {
    const newExpiredate = '';
    return newExpiredate;
  }
};

const buildVideotronOffer = (getVideotronOffer) => {
  const serviceCharacteristic = [];
  const videotron = getVideotronOffer.map((item) => {
    const Offer = {
      id: item.TELUS_OFFER_ID,
      name: item.TELUS_OFFER_NAME,
      value: {
        speed: item.SPEED,
        technology: item.TECHNOLOGY,
      },
    };
    serviceCharacteristic.push(Offer);
  });
  return serviceCharacteristic;
};

const buildHistoryLogNoFootprint = (partnerOfferNf) => {
  const mapOffer = partnerOfferNf.map((item) => {
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
  return mapOffer;
};

// On-Net
const buildOnNetRelatedParty = () => {
  const relatedParty = {
    name: 'Shaw',
    role: 'Partner',
    '@type': 'RelatedParty',
    '@referredType': 'Organization',
  };
  return relatedParty;
};

const buildOnNetServiceCharacteristic = (getOffers) => {
  const serviceCharacteristic = [];
  const OnNetShawOffer = getOffers.map((item) => {
    const onNetOffer = {
      id: item.TELUS_OFFER_ID,
      name: item.PARTNER_OFFER_NAME,
      value: {
        speed: item.SPEED,
        technology: item.TECHNOLOGY,
      },
    };
    serviceCharacteristic.push(onNetOffer);
  });
  return serviceCharacteristic;
};

const buildOnNetServiceSpecification = () => {
  const serviceSpecification = {
    id: '1',
    href: 'http://placeholder/catalog/off-net/services/1',
    name: 'On-Net Location',
    version: '1.0',
    '@type': 'ServiceSpecification',
  };
  return serviceSpecification;
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

const _buildExternalApiRequestObject = (amsAddress) => {
  const GEO_STADDRESS = [
    amsAddress.Addresses[0].unit,
    amsAddress.Addresses[0].floor,
    amsAddress.Addresses[0].streetNumberPrefix,
    amsAddress.Addresses[0].streetNumber,
    amsAddress.Addresses[0].streetNumberSuffix,
    amsAddress.Addresses[0].dirPrefix,
    amsAddress.Addresses[0].streetTypePrefix,
    amsAddress.Addresses[0].streetName,
    amsAddress.Addresses[0].streetTypeSuffix,
    amsAddress.Addresses[0].dirSuffix,
  ].filter((x) => !!x);
  return {
    GEO_STADDRESS: GEO_STADDRESS.join(' '),
    GEO_STNUMBER: amsAddress.Addresses[0].streetNumber,
    GEO_STNAME: amsAddress.Addresses[0].streetName,
    //GEO_STTYPE: amsAddress.Addresses[0].streetTypeSuffix.substr(0, 2),
    GEO_ST_TYPE_PREFIX: amsAddress.Addresses[0].streetTypePrefix,
    GEO_STREETTYPESUFFIX: amsAddress.Addresses[0].streetTypeSuffix,
    DIR_SUFFIX: amsAddress.Addresses[0].dirSuffix,
    GEO_COUNTRY: amsAddress.Addresses[0].country,
    GEO_CITY: amsAddress.Addresses[0].city,
    GEO_PROVINCE: amsAddress.Addresses[0].province,
    GEO_POSTAL: amsAddress.Addresses[0].postalCode,
    LATITUDE: amsAddress.Addresses[0].coordinate.latitude,
    LONGITUDE: amsAddress.Addresses[0].coordinate.longitude,
    VTRON_STADDRESS: `${amsAddress.Addresses[0].streetNumber} ${amsAddress.Addresses[0].streetName}`,
  };
};

const buildExternalApiRequestObjectVideotron = (amsAddress) => {
  return {
    GEO_unit: amsAddress.Addresses[0].unit,
    GEO_floor: amsAddress.Addresses[0].floor,
    GEO_streetNumberPrefix: amsAddress.Addresses[0].streetNumberPrefix,
    GEO_streetNumber: amsAddress.Addresses[0].streetNumber,
    GEO_streetNumberSuffix: amsAddress.Addresses[0].streetNumberSuffix,
    GEO_dirPrefix: amsAddress.Addresses[0].dirPrefix,
    GEO_streetTypePrefix: amsAddress.Addresses[0].streetTypePrefix,
    GEO_streetName: amsAddress.Addresses[0].streetName,
    GEO_streetTypeSuffix: amsAddress.Addresses[0].streetTypeSuffix,
    GEO_dirSuffix: amsAddress.Addresses[0].dirSuffix,
    GEO_city: amsAddress.Addresses[0].city,
    GEO_province: amsAddress.Addresses[0].province,
    GEO_postalCode: amsAddress.Addresses[0].postalCode,
    GEO_country: amsAddress.Addresses[0].country,
    LATITUDE: amsAddress.Addresses[0].coordinate.latitude,
    LONGITUDE: amsAddress.Addresses[0].coordinate.longitude,
  };
};

const _doProcessShawApiRequest = async (address) => {
  try {
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
  } catch (error) {
    debug('Shaw api has an error:', error);
    return false;
  }
};

const _handleShawTrueApitoDB = async (coax, fiber, province) => {
  let parsedResultDB = [];
  if (coax.toUpperCase() === fiber.toUpperCase()) {
    const connection = await dbServer.getConnection();
    const querySelect = `SELECT * FROM PARTNER_OFFERS WHERE  PARTNER_OFFER_STATUS = 'Active'
      AND PROVINCE_ABBREV = ${connection.escape(
        province
      )}AND PARTNER_OFFER_NAME LIKE 'Shaw%'`;
    const resultCoaxFiber = await _queryShawOfferinPartners(
      connection,
      querySelect
    );
    parsedResultDB.push(resultCoaxFiber);
  } else if (fiber.toUpperCase() === 'Y') {
    const connection = await dbServer.getConnection();
    const querySelect = `SELECT * FROM PARTNER_OFFERS WHERE PARTNER_OFFER_STATUS = 'Active'
      AND PROVINCE_ABBREV = ${connection.escape(
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
    const querySelect = `SELECT * FROM PARTNER_OFFERS WHERE PARTNER_OFFER_STATUS = 'Active'
      AND PROVINCE_ABBREV = ${connection.escape(
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

// main function to consume by client
const processNoFootprintItems = async (
  csqRequestBody,
  isInstantSync,
  noFootprintLpdsIds
) => {
  return new Promise((resolve, reject) => {
    (async () => {
      const serviceQualItemState = isInstantSync
        ? STATUS.DONE
        : STATUS.IN_PROGRESS;

      const finalNoFootprintServiceQualItems = [];
      let emailDetails = [];
      let historyLogsDetails = [];

      let isNoFootprintWithAmsExists = false;
      let isNoFootprintWithoutAmsExists = false;
      let isApiDown = false;

      debug('instant sync from request: ', isInstantSync);
      debug('processing no_footprint lpds_ids:', noFootprintLpdsIds);

      try {
        for (const nfLpdsID of noFootprintLpdsIds) {
          debug('on nofootprint Collection...', nfLpdsID);

          // CR46-Cr48
          const buildNoFootPrintOnNet = await csqExpiredItemsProcessor.getBuildOnnet(
            nfLpdsID
          );
          debug('buildExpireOnNet', buildNoFootPrintOnNet);
          if (buildNoFootPrintOnNet !== undefined) {
            finalNoFootprintServiceQualItems.push(buildNoFootPrintOnNet);
          }

          //Process Default Use Case
          const amsAddress = await amsApi.getAddressByLpdsId(nfLpdsID);
          //debug('on nofootprint getAddressByLpdsId result: ', amsAddress);

          if (amsAddress !== undefined && buildNoFootPrintOnNet == undefined) {
            debug('start of no_footprint processor with AMS');
            isNoFootprintWithAmsExists = true;
            // for external APIs (SHAW and BELL)

            const external_api_address = _buildExternalApiRequestObject(
              amsAddress
            );
            debug(
              'on nofootprint address request for external APIs:',
              external_api_address,
              0,
              2
            );

            //Cr-58 Centralized places per lpdsId
            const getOnnetNearnetNf = await dbRepository.queryOnnetNearnet(
              nfLpdsID
            );

            const places = _buildPlacesFromAmsAddress(amsAddress, nfLpdsID);

            const placesOnnetNearnetNf = csqExpiredItemsProcessor.buildPlacesOnnetNearnet(
              places,
              getOnnetNearnetNf
            );

            // for email attachment
            const add = csqAbtractService.buildEmailAttachmentObject(
              amsAddress,
              nfLpdsID
            );
            debug('on nofootprint email attachment object:', add);

            const province = amsAddress.Addresses[0].province;
            debug('on nofootprint province:', province);
            let noFootprintPartnersData = [];
            const addCollect = ADMIN.collection('addressCollection').doc();
            await addCollect.set(add);

            // instantSyncQualification=False will send Email to Vendor - Filter by Province

            if (isInstantSync !== true) {
              debug(
                'False implementation in main API is decomission in CR97 CR98'
              );

              //end of False Case
            } else {
              debug('instantSync is True', isInstantSync);

              debug('calling Rogers API-True...');
              const rogersProvince = province.toUpperCase();
              const getRogersProvinceNf = await dbRepository.queryRogersProvince();
              const rogersFromDb = getRogersProvinceNf.flatMap(
                (row) => row.PROVINCE_ABBREV
              );

              if (rogersFromDb.includes(rogersProvince)) {
                const trackingNumberNf = await csqExpiredItemsProcessor.getTrackingNumber(
                  amsAddress,
                  URL.CONFIG_STRING_1000
                );
                debug('rfqTrackingNumber..', trackingNumberNf);

                if (trackingNumberNf !== undefined) {
                  await delay();

                  const indentifyPowerQoutes = await csqExpiredItemsProcessor.getIndentifyPowerQoutes(
                    trackingNumberNf,
                    rogersProvince
                  );

                  noFootprintPartnersData.push(indentifyPowerQoutes[0]);

                  if (indentifyPowerQoutes[1].length !== 0) {
                    const buildHistoryLogRoger = buildHistoryLogNoFootprint(
                      indentifyPowerQoutes[1]
                    );

                    const rogersDetailsAms = await _amsToHistoryLog(amsAddress);
                    historyLogsDetails.push({
                      parseAmsDetails: rogersDetailsAms,
                      offers: buildHistoryLogRoger,
                    });
                  }
                } else {
                  debug('Rogers Api is Down or Timeout');
                  const rogersExpiry = moment().format(STANDARD.DATE_FORMAT);
                  const serviceCharacteristic = [];
                  noFootprintPartnersData.push({
                    name: 'Rogers',
                    offer: serviceCharacteristic,
                    duration: rogersExpiry,
                    code: '006',
                  });
                }
              }

              // if Province not equal to AB and BC, call SHAW API
              debug('calling Shaw API-T...');
              const getProvinceOfShawNf = await dbRepository.queryProvinceOfShaw();
              const provinceShawFromDbNf = getProvinceOfShawNf.flatMap(
                (row) => row.PROVINCE_ABBREV
              );

              if (provinceShawFromDbNf.includes(province.toUpperCase())) {
                const tariffsInfo = await _doProcessShawApiRequest(
                  external_api_address,
                  province
                );
                // if (tariffsInfo !== undefined || tariffsInfo.length !== 0) {
                if (tariffsInfo !== false) {
                  // THIS COMMENT IS FOR TESTING/CHANING Shaw offer values.
                  // const samplex = tariffsInfo.map(param => {
                  //   if (param.Name[0] === 'Coax') {
                  //     param.Value[0] = 'None'
                  //   }
                  //   return param;
                  // });
                  // const samplez = tariffsInfo.map(params => {
                  //   if (params.Name[0] === 'Fiber') {
                  //     params.Value[0] = 'y'
                  //   }
                  //   return params;
                  // });

                  const coax = tariffsInfo
                    .filter((data) => data.Name[0] === 'Coax')
                    .map((data) => {
                      return !data.Value[0] ? 'None' : data.Value[0];
                    })
                    .join('');
                  debug('coax', coax);

                  const fiber = tariffsInfo
                    .filter((data) => data.Name[0] === 'Fiber')
                    .map((data) => {
                      return !data.Value[0] ? 'None' : data.Value[0];
                    })
                    .join('');
                  debug('fiber', fiber);

                  const locType = tariffsInfo.find(
                    (data) => data.Name[0] === 'LocationType'
                  );

                  const locTypeValue = locType.Value;
                  debug('LocationType', locType, locTypeValue);
                  debug('Location Type Value', locTypeValue, province);

                  if (
                    locTypeValue !== 'On-Net' &&
                    (fiber != 'None' || coax != 'None')
                  ) {
                    const callPartner_OfferDB = await _handleShawTrueApitoDB(
                      coax,
                      fiber,
                      province
                    );
                    debug(
                      'this is for No FootPrint query from DB',
                      callPartner_OfferDB
                    );
                    const shawOffer = callPartner_OfferDB.map((item) => {
                      return {
                        name: item.TELUS_OFFER_NAME,
                        id: item.TELUS_OFFER_ID,
                        value: {
                          speed: item.SPEED,
                          technology: item.TECHNOLOGY,
                        },
                      };
                    });

                    const shawDuration = await dbRepository.vendorDurationQuery(
                      'Shaw'
                    );
                    const addDuration = shawDuration.map(
                      (row) => row.FOOTPRINT_DURATION
                    );
                    const expiryDate = moment()
                      .add(addDuration, 'days')
                      .format(STANDARD.DATE_FORMAT);

                    noFootprintPartnersData.push({
                      name: 'Shaw',
                      offer: shawOffer,
                      duration: expiryDate,
                      code: '1',
                    });

                    const parseNoFootprintAmsDetails = await _amsToHistoryLog(
                      amsAddress
                    );
                    historyLogsDetails.push({
                      parseAmsDetails: parseNoFootprintAmsDetails,
                      offers: callPartner_OfferDB,
                    });
                  } else {
                    debug('This feature is under negotiation status!!!!!!!!!!');
                  }
                } else {
                  debug('Shaw API is down...');
                  const newExpiredate = moment().format(STANDARD.DATE_FORMAT);
                  const serviceCharacteristic = [];
                  noFootprintPartnersData.push({
                    name: 'Shaw',
                    offer: serviceCharacteristic,
                    duration: newExpiredate,
                    code: '006',
                  });
                }
              }

              // Call BELL API - uncomment this block if BELL is available
              debug('calling Bell API-T...');
              const bellProvince = external_api_address.GEO_PROVINCE;
              const getProvinceOfBellNf = await dbRepository.queryProvinceBell();
              const provBellFromDbNf = getProvinceOfBellNf.flatMap(
                (row) => row.PROVINCE_ABBREV
              );

              if (provBellFromDbNf.includes(bellProvince.toUpperCase())) {
                const bellPresaleProducts = await _doProcessBellApiRequest(
                  external_api_address
                );
                debug('bellPresaleProducts', bellPresaleProducts);
                const identifyBell = await csqExpiredItemsProcessor.getIdentifyBell(
                  bellPresaleProducts,
                  bellProvince
                );
                noFootprintPartnersData.push(identifyBell[0]);
                if (identifyBell[1].length !== 0) {
                  const buildHistoryLogBell = buildHistoryLogNoFootprint(
                    identifyBell[1]
                  );
                  const bellDetailsAms = await _amsToHistoryLog(amsAddress);
                  historyLogsDetails.push({
                    parseAmsDetails: bellDetailsAms,
                    offers: buildHistoryLogBell,
                  });
                }
              }

              debug('calling Videotron API-T...');
              debug('province..', external_api_address);
              const videotronProvince = external_api_address.GEO_PROVINCE;
              const getProvOfVideotronNfT = await dbRepository.queryProvinceVideotron();
              const provinceVideotron = getProvOfVideotronNfT.flatMap(
                (row) => row.PROVINCE_ABBREV
              );
              if (provinceVideotron.includes(videotronProvince)) {
                const videotronAddress = buildExternalApiRequestObjectVideotron(
                  amsAddress
                );
                const videotronResponse = await csqAbtractService.doProcessVideotronApiRequest(
                  videotronAddress
                );
                debug('videotronResponse', videotronResponse);

                const identifyVideotron = await csqExpiredItemsProcessor.getIdentifyVideotron(
                  videotronResponse,
                  videotronProvince
                );

                noFootprintPartnersData.push(identifyVideotron[0]);

                if (identifyVideotron[1].length !== 0) {
                  const buildHistoryVideotron = buildHistoryLogNoFootprint(
                    identifyVideotron[1]
                  );
                  const videotronDetailsAms = await _amsToHistoryLog(
                    amsAddress
                  );
                  historyLogsDetails.push({
                    parseAmsDetails: videotronDetailsAms,
                    offers: buildHistoryVideotron,
                  });
                }
              }

              //  Partner with Email_Enable in Query Province  CR55 - July 8 2021 new implementation(citybase)
              const citybasePartner = await dbRepository.getEmailPartnerCityBasedSearch(
                external_api_address.GEO_CITY.toUpperCase(),
                external_api_address.GEO_PROVINCE.toUpperCase()
              );
              const cityBaseEmailPartner = citybasePartner.flatMap(
                (row) => row.PARTNER_NAME
              );

              if (
                cityBaseEmailPartner.length !== 0 ||
                cityBaseEmailPartner !== undefined
              ) {
                for (const iter of cityBaseEmailPartner) {
                  noFootprintPartnersData.push({
                    name: iter,
                    offer: [],
                    duration: moment().format(STANDARD.DATE_FORMAT),
                  });
                }
              }

              // build noFootprintItems
              let noFootprintCounter = 0;
              noFootprintPartnersData.forEach((partner) => {
                // places - DONE
                const places = _buildPlacesFromAmsAddress(amsAddress, nfLpdsID);

                const placesOnnetNearnetNfTrue = csqExpiredItemsProcessor.buildPlacesOnnetNearnet(
                  places,
                  getOnnetNearnetNf
                );

                // build relatedParty object
                const relatedParty = _buildRelatedPartyObject(partner.name);
                const apiPartner = partner.name;
                const partnerCode = partner.code;
                // serviceCharacteristic object
                const serviceCharacteristic = [...partner.offer];

                const qualificationResult = identifyQualificationResult(
                  serviceCharacteristic
                );

                // serviceSpecification object
                const serviceSpecification = _findServiceQualItemByPlaceId(
                  csqRequestBody.serviceQualificationItem,
                  nfLpdsID
                ).service.serviceSpecification;
                const partnerApi = ['Shaw', 'Bell', 'Videotron', 'Rogers'];

                if (partnerApi.includes(apiPartner)) {
                  const itemId = (noFootprintCounter += 1);
                  const partnerDuration = partner.duration;
                  const noFootPrintItem = formNoFootPrintItem(
                    itemId,
                    partnerCode,
                    partnerDuration,
                    serviceQualItemState,
                    qualificationResult,
                    placesOnnetNearnetNfTrue,
                    relatedParty,
                    serviceCharacteristic,
                    serviceSpecification
                  );

                  finalNoFootprintServiceQualItems.push(noFootPrintItem);
                } else {
                  const noFootPrintItem = {
                    id: (noFootprintCounter += 1),
                    expirationDate: partner.duration,
                    state: serviceQualItemState,
                    qualificationResult: 'unqualified',
                    eligibilityunavailabilityreason: [
                      {
                        code: '003',
                        label: 'unknown/inquiry required',
                      },
                    ],
                    service: {
                      serviceType: 'business',
                      place: placesOnnetNearnetNfTrue,
                      relatedParty,
                      serviceCharacteristic,
                      serviceSpecification,
                    },
                  };

                  finalNoFootprintServiceQualItems.push(noFootPrintItem);
                }
              });
            }
          } else {
            debug('no_footprint processor no AMS');
            const noAmsItem = buildNoAmsItem(nfLpdsID);
            finalNoFootprintServiceQualItems.push(noAmsItem);
            isNoFootprintWithoutAmsExists = true;
          }
        }

        debug(
          'finalNoFootprintServiceQualItems count:',
          finalNoFootprintServiceQualItems.length
        );
        resolve({
          emailDetails: emailDetails,
          serviceQualificationItem: finalNoFootprintServiceQualItems,
          historyLogsDetails: historyLogsDetails,
          isNoFootprintWithAmsExists,
          isNoFootprintWithoutAmsExists,
          isApiDown,
        });
      } catch (err) {
        debug('CSQ ERROR:', err);
        reject({
          processor: 'NO_FOOTPRINT PROCESSOR',
          status: STATUS.TERMINATED_WITH_ERROR,
          message: err.message,
        });
      }
    })();
  });
};

export default {
  processNoFootprintItems,
  getFindPartnerInMulitipleSpecifiedEP,
  buildExternalApiRequestObjectVideotron,
  buildVideotronOffer,
  _buildExternalApiRequestObject,
  delay,
  _doProcessShawApiRequest,
  _handleShawTrueApitoDB,
  identifyQualificationResult,
  _doProcessBellApiRequest,
  getBuildBellOffer,
};
