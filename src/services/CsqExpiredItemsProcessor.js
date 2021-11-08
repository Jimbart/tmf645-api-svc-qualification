import createDebug from 'debug';
import path from 'path';
import STATUS from '../utils/enums/StatusEnum';
import STANDARD from '../utils/enums/StandardEnum';
import amsApi from '../vendor_api/AmsApi';
import dbRepository from '../repository/DatabaseRepository';
import moment from 'moment';
import * as dbServer from '../dbServer';
import ShawApi from '../vendor_api/ShawApi';
import BellApi from '../vendor_api/BellApi';
import csqAbtractService from '../services/CsqAbstractService';
import fs from 'fs';
import firestoreConfig from '../firestore/firestore-config';
import firestoreRepository from '../repository/FirestoreRepository';
import FIRESTORE_ENUM from '../utils/enums/FirestoreEnum';
import URL from '../utils/enums/UrlEnum';
import csqNoFootprintProcessor from '../services/CsqNoFootprintProcessor';
import AddressStringBuilder from '../utils/AddressStringBuilder';
import parsestring from 'xml2js';

const axios = require('axios');
const debug = createDebug(path.basename(__filename, '.js'));

// private functions here
//Bell
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
    debug('Bell Api has an error!!', error);
    return false;
  }
};

//Rogers API

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const delay = async () => {
  console.log('delay 5 seconds...');
  await sleep(5000);
};

const getDummmyPowerQuote = async () => {
  try {
    const dummyPath = `${__dirname}/../tests/ams_testdata/rogersPowerquotes_dummy.json`;
    const rogersData = fs.readFileSync(dummyPath);
    const rogersJson = JSON.parse(rogersData);
    debug(rogersJson);
    return rogersJson;
  } catch (error) {
    return false;
  }
};

const getTriggerPowerQoutes = async (rfs) => {
  const token = Buffer.from(
    `${process.env.ROGERS_UN}:${process.env.ROGERS_PW}`,
    'utf8'
  ).toString('base64');

  const url = URL.ROGERS_GET_URL + rfs;
  debug(url);
  try {
    return axios
      .get(url, {
        headers: {
          Authorization: `Basic ${token}`,
        },
      })
      .then((res) => {
        try {
          debug('data..', res.data);
          return res.data;
        } catch (error) {
          debug('Rogers Api has an error!!', error);
          return false;
        }
      });
  } catch (error) {
    debug(error);
    return false;
  }
};

const getPowerQoutes = async (rfs) => {
  if (process.env.NODE_ENV == 'production') {
    // const triggerPowerQoutes = {
    //   rfqStatus: 'Executing',
    //   rfqNotes: 'Rogers Only',
    //   quotes: 'No quotes returned.',
    // };
    //const triggerPowerQoutes = false;
    const triggerPowerQoutes = await getTriggerPowerQoutes(rfs);
    debug(triggerPowerQoutes.rfqStatus);
    if (
      triggerPowerQoutes.rfqStatus == 'Executing' ||
      triggerPowerQoutes == false
    ) {
      for (let i = 0; i < 4; i++) {
        await delay();
        console.log(i);
        let retryGetTriggerPowerQoutes = await getTriggerPowerQoutes(rfs);

        console.log(retryGetTriggerPowerQoutes.rfqStatus);
        if (retryGetTriggerPowerQoutes.rfqStatus == 'Completed') {
          return retryGetTriggerPowerQoutes;
          break;
        }
      }
      return triggerPowerQoutes;
    } else {
      return triggerPowerQoutes;
    }
  } else {
    debug('environment= ', process.env.NODE_ENV);
    return getDummmyPowerQuote();
  }
};

const getDummyRfqTrackingNumber = async () => {
  try {
    const dummyPath = `${__dirname}/../tests/ams_testdata/rogersRfsTracking_dummy.json`;
    const rogersData = fs.readFileSync(dummyPath);
    const rogersJson = JSON.parse(rogersData);
    return rogersJson.rfqTrackingNumber;
  } catch (error) {
    return false;
  }
};

const getRogersProfile = async (powerQoutes, rogersProvince) => {
  const isBad = ['No quotes returned.'];
  if (isBad.includes(powerQoutes.quotes)) {
    debug('Not qualified for giga profile!!!!!');
  } else {
    const giga = [
      powerQoutes.quotes[0].providers[0].locations[0].skus[0].name,
      powerQoutes.quotes[0].providers[0].locations[0].skus[1].name,
      powerQoutes.quotes[0].providers[0].locations[0].skus[2].name,
    ];
    if (giga.includes(URL.GIGA_PROFILE)) {
      const rogersPartnerOffers = await dbRepository.getRogersPartnerOffers(
        rogersProvince,
        1000
      );

      return rogersPartnerOffers;
    }
  }
};

const getTrackingNumber = async (amsAddress, config) => {
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

  const GEO_CITY = amsAddress.Addresses[0].city;
  const GEO_PROVINCE = amsAddress.Addresses[0].province;
  const GEO_POSTAL = amsAddress.Addresses[0].postalCode;

  if (process.env.NODE_ENV == 'production') {
    try {
      const token = Buffer.from(
        `${process.env.ROGERS_UN}:${process.env.ROGERS_PW}`,
        'utf8'
      ).toString('base64');
      const url = URL.ROGERS_POST_URL;
      const data = {
        customerInfo: {
          contact: '09294420189',
          phone: '2954432',
          email: URL.TELUS_EXCHANGE,
          company: 'TIP',
        },
        productType: 'IP Services',
        config: config,
        terms: '1',
        locations: [
          {
            location_name: '',
            npanxx: '',
            street: GEO_STADDRESS.join(' '),
            city: GEO_CITY,
            sub_locality: '',
            state: GEO_PROVINCE,
            zip: GEO_POSTAL,
            country: 'CANADA',
          },
        ],
        restrictedProviders: 'QualAPi query',
        rfqNotes: 'Rogers Only',
      };

      return axios
        .post(url, data, {
          headers: {
            Authorization: `Basic ${token}`,
          },
        })
        .then((res) => {
          debug(res.data);
          return res.data.rfqTrackingNumber;
        })
        .catch((err) =>
          debug(
            'No locations could be added successfully due to missing address info or address validation failure or something went wrong'
          )
        );
    } catch (error) {
      debug('something is wrong...', error);
      return false;
    }
  } else {
    debug(' environment =', process.env.NODE_ENV);
    return getDummyRfqTrackingNumber();
  }
};

const getBuildRogersOffer = (rogersPartnerOffers) => {
  const serviceCharacteristic = [];
  const roger = rogersPartnerOffers.map((item) => {
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

// Bell

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

const buildOnNetPlacesX = (getOnNetExpire, expiredLpdsId) => {
  const objectAlterX = getOnNetExpire.map((item) => {
    const place = {
      id: expiredLpdsId,
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
  return objectAlterX;
};

const buildOnNetRelatedPartyX = () => {
  const relatedParty = {
    name: 'Shaw',
    role: 'Partner',
    '@type': 'RelatedParty',
    '@referredType': 'Organization',
  };
  return relatedParty;
};

const buildOnNetServiceCharacteristicX = (getOffersX) => {
  const serviceCharacteristic = [];
  const OnNetShawOffer = getOffersX.map((item) => {
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

const buildOnNetServiceSpecificationX = () => {
  const serviceSpecification = {
    id: '1',
    href: 'http://placeholder/catalog/off-net/services/1',
    name: 'On-Net Location',
    version: '1.0',
    '@type': 'ServiceSpecification',
  };
  return serviceSpecification;
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

const _findServiceQualItemByPlaceId = (serviceQualItem, placeId) => {
  return serviceQualItem.find((item) => {
    return item.service.place.find(
      (place) => place.id.toString() === placeId.toString()
    );
  });
};

//for email instantSync_false
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
      id: placeId,
      unit: manageUnit,
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

// Cr58

const buildPlacesOnnetNearnet = (places, getOnnetNearnet) => {
  const identifyAddressType = getOnnetNearnet.map(
    (row) => row.PARTNER_ADDRESS_TYPE
  );

  if (identifyAddressType != 0) {
    const addressTypeToString = identifyAddressType.toString();
    places[0].addressType = addressTypeToString;
    return places;
  } else {
    places[0].addressType = 'Off net';
    return places;
  }
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
    debug('shaw api has an error:', error);
    return false;
  }
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
    const querySelect = `SELECT * FROM PARTNER_OFFERS WHERE PARTNER_OFFER_STATUS = 'Active'
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

const _generateServiceQualificationItem = (place, relatedPartyName) => {
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

const buildExpiryDate = (shawOffer, addDuration) => {
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

// CR55
const buildServiceCharCr55X = (grabPartnerOfferX) => {
  const serviceCharacteristic = [];
  const cr55 = grabPartnerOfferX.map((item) => {
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

//Cr69
const formExpiredItem = (
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

const formExpiredItemFx = (
  partnerCode,
  partnerDuration,
  qualificationResultFx,
  places,
  relatedParty,
  serviceCharacteristic,
  serviceSpecification
) => {
  if (partnerCode == '006') {
    const item = {
      expirationDate: partnerDuration,
      state: 'terminatedWithError',
      qualificationResult: qualificationResultFx,
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
      qualificationResult: qualificationResultFx,
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
      qualificationResult: qualificationResultFx,
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

const buildExpiryVideotron = (videotronOffer, addDuration) => {
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

const buildVideotronOfferExpire = (getVideotronOffer) => {
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

const buildHistoryLogExpire = (partnerOffer) => {
  const mapOffer = partnerOffer.map((item) => {
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

// Onnet Refactor
const getBuildOnnet = async (expiredLpdsId) => {
  const getOnNetExpire = await dbRepository.queryToConfirmIfLpdsIdIsOnnet(
    expiredLpdsId
  );
  if (getOnNetExpire == undefined || getOnNetExpire.length === 0) {
    debug('Expire lpds_id Not Found in On-Net database!!!');
  } else {
    let onNetItemCounterX = 0;
    const onNetX_places = buildOnNetPlacesX(getOnNetExpire, expiredLpdsId);
    debug('Expire On-net places....', onNetX_places);
    const findProvinceX = getOnNetExpire.map((row) => row.GEO_PROVINCE);
    debug('province..', findProvinceX);
    const getOffersX = await dbRepository.queryToGetOfferFromShaw(
      findProvinceX
    );

    const relatedParty = buildOnNetRelatedPartyX();
    debug('onNetRelatedParty for Expire..', relatedParty);
    const serviceCharacteristic = buildOnNetServiceCharacteristicX(getOffersX);
    debug('onNetServiceCharacteristic for Expire....', serviceCharacteristic);
    const serviceSpecification = buildOnNetServiceSpecificationX();
    debug('onNetServiceSpecification for Expire..', serviceSpecification);
    const onNetItemX = {
      id: (onNetItemCounterX += 1),
      expirationDate: '',
      state: 'done',
      service: {
        serviceType: 'business',
        place: onNetX_places,
        relatedParty,
        serviceCharacteristic,
        serviceSpecification,
      },
    };

    return onNetItemX;
  }
};

const getDuration = async (partnerName) => {
  const dbDuration = await dbRepository.rogersDurationQuery(partnerName);
  const duration = dbDuration.map((row) => row.FOOTPRINT_DURATION);
  const partnerExpiry = moment()
    .add(duration, 'days')
    .format(STANDARD.DATE_FORMAT);
  return partnerExpiry;
};

const getIdentifyBell = async (bellPresaleProducts, bellProvince) => {
  const bellIdentifiedItem = [];
  const duration = await getDuration('BELL');
  debug('duration....', duration);
  if (bellPresaleProducts == 'No Offer.') {
    const bellNoOffer = [];
    const bellItem = {
      name: 'Bell',
      offer: bellNoOffer,
      duration: duration,
      code: '007',
    };
    bellIdentifiedItem.push(bellItem, bellNoOffer);
  } else if (bellPresaleProducts == false) {
    const bellNoOffer = [];
    const bellItem = {
      name: 'Bell',
      offer: bellNoOffer,
      duration: moment().format(STANDARD.DATE_FORMAT),
      code: '006',
    };
    bellIdentifiedItem.push(bellItem, bellNoOffer);
  } else {
    const downloadSpeed = bellPresaleProducts.find((prop) => {
      return prop.name[0] === 'DownloadSpeed';
    });

    const downloadTrunc = downloadSpeed.value[0];
    if (downloadTrunc !== 0) {
      const round = Math.round(downloadTrunc / 1000);

      const getBellOffer = await dbRepository.queryBellOffer(
        bellProvince,
        round
      );
      const buildBellOffer = csqNoFootprintProcessor.getBuildBellOffer(
        getBellOffer
      );
      debug('buildBellOffer....', buildBellOffer);
      // const bellNoOffer = [];
      const bellItem = {
        name: 'Bell',
        offer: buildBellOffer,
        duration: duration,
        code: '1',
      };
      bellIdentifiedItem.push(bellItem, getBellOffer);
    }
  }

  return bellIdentifiedItem;
};

const getIdentifyVideotron = async (videotronResponse, videotronProvince) => {
  const videotronIdentifiedItem = [];
  const duration = await getDuration('VIDEOTRON');
  debug('duration....', duration);

  if (videotronResponse !== true) {
    try {
      parsestring.parseString(videotronResponse, function (err, result) {
        const response =
          result['soap:Envelope']['soap:Body'][0]['soap:Fault'][0].faultstring;
        debug('response', response);
        if (response == 'No solution is available.') {
          const videotronProfile = [];
          const videotronItem = {
            name: 'Videotron',
            offer: videotronProfile,
            duration: duration,
            code: '007',
          };

          videotronIdentifiedItem.push(videotronItem, videotronProfile);
        }
      });
    } catch (error) {
      debug('error', error);
      const videotronProfile = [];
      const videotronItem = {
        name: 'Videotron',
        offer: videotronProfile,
        duration: moment().format(STANDARD.DATE_FORMAT),
        code: '006',
      };
      videotronIdentifiedItem.push(videotronItem, videotronProfile);
    }
  } else if (videotronResponse == true) {
    const getVideotronOffer = await dbRepository.queryVideotronOffer(
      videotronProvince
    );
    const videotronOffer = buildVideotronOfferExpire(getVideotronOffer);

    const videotronItem = {
      name: 'Videotron',
      offer: videotronOffer,
      duration: duration,
      code: '1',
    };
    videotronIdentifiedItem.push(videotronItem, getVideotronOffer);
  }

  return videotronIdentifiedItem;
};

const getIndentifyPowerQoutes = async (trackingNumber, rogersProvince) => {
  const powerQoutes = await getPowerQoutes(trackingNumber);
  //const powerQoutes = false;
  if (
    powerQoutes.rfqStatus == 'Completed' &&
    powerQoutes.quotes == 'No quotes returned.'
  ) {
    const rogersProfile = [];
    const rogerDuration = await getDuration('ROGERS');
    debug('rogerDuration....', rogerDuration);
    const rogersItem = {
      name: 'Rogers',
      offer: rogersProfile,
      duration: rogerDuration,
      code: '007',
    };
    return [rogersItem, rogersProfile];
  } else if (
    powerQoutes.rfqStatus === 'Completed' &&
    powerQoutes.quotes.length !== 0
  ) {
    const rogersProfile = await getRogersProfile(powerQoutes, rogersProvince);
    const buildRogersOffer = getBuildRogersOffer(rogersProfile);
    const rogerDuration = await getDuration('ROGERS');
    const rogersItem = {
      name: 'Rogers',
      offer: buildRogersOffer,
      duration: rogerDuration,
      code: '1',
    };
    return [rogersItem, rogersProfile];
  } else if (
    powerQoutes.rfqStatus === 'Executing' &&
    powerQoutes.quotes === 'No quotes returned.'
  ) {
    debug('Rogers Api is Down or Timeout');
    const rogersExpiry = moment().format(STANDARD.DATE_FORMAT);
    const rogersProfile = [];
    const rogersItem = {
      name: 'Rogers',
      offer: rogersProfile,
      duration: rogersExpiry,
      code: '006',
    };
    return [rogersItem, rogersProfile];
  } else {
    debug('Rogers Api is Down or Timeout');
    const rogersExpiry = moment().format(STANDARD.DATE_FORMAT);
    const rogersProfile = [];
    const rogersItem = {
      name: 'Rogers',
      offer: rogersProfile,
      duration: rogersExpiry,
      code: '006',
    };
    return [rogersItem, rogersProfile];
  }
};

// main function to consume by client
const processExpiredItems = (csqRequestBody, isInstantSync, expiredLpdsIds) => {
  return new Promise((resolve, reject) => {
    (async () => {
      const serviceQualItemState = isInstantSync
        ? STATUS.DONE
        : STATUS.IN_PROGRESS;

      let finalExpiredServiceQualItems = [];
      let emailDetails = [];
      let historyLogsDetails = [];

      let isApiDown = false;

      debug('isInstantSync:', isInstantSync);
      debug('processing expired lpds_ids:', expiredLpdsIds);
      try {
        for (const expiredLpdsId of expiredLpdsIds) {
          debug('processing expired lpds_id:', expiredLpdsId);

          // CR46-Cr48
          const buildExpireOnNet = await getBuildOnnet(expiredLpdsId);
          debug('buildExpireOnNet', buildExpireOnNet);
          if (buildExpireOnNet !== undefined) {
            finalExpiredServiceQualItems.push(buildExpireOnNet);
          }

          const amsAddress = await amsApi.getAddressByLpdsId(expiredLpdsId);
          if (amsAddress !== undefined && buildExpireOnNet == undefined) {
            // isExpiredExists = true;
            const externalApiRequestObject = _buildExternalApiRequestObject(
              amsAddress
            );
            debug('external api object request:', externalApiRequestObject);
            //Cr-58 Centralized places per lpdsId
            const getOnnetNearnet = await dbRepository.queryOnnetNearnet(
              expiredLpdsId
            );

            const places = _buildPlacesFromAmsAddress(
              amsAddress,
              expiredLpdsId
            );

            const placesOnnetNearnet = buildPlacesOnnetNearnet(
              places,
              getOnnetNearnet
            );

            const emailAttachmentObject = csqAbtractService.buildEmailAttachmentObject(
              amsAddress,
              expiredLpdsId
            );

            const province = amsAddress.Addresses[0].province;
            debug('province:', province);

            let expiredPartnersData = []; // populate if isInstantSync = true

            if (!isInstantSync) {
              debug(
                'False implementation in main API is decomission in CR97 CR98'
              );
              // end of isInstantSync False
            } else {
              // calling external APIs
              debug('calling Rogers API-True');
              const rogersProvince = province.toUpperCase();
              const getRogersProvince = await dbRepository.queryRogersProvince();
              const rogersFromDb = getRogersProvince.flatMap(
                (row) => row.PROVINCE_ABBREV
              );
              if (rogersFromDb.includes(rogersProvince)) {
                const trackingNumber = await getTrackingNumber(
                  amsAddress,
                  URL.CONFIG_STRING_1000
                );
                debug('rfqTrackingNumber..', trackingNumber);

                if (trackingNumber !== undefined) {
                  await delay();

                  const indentifyPowerQoutes = await getIndentifyPowerQoutes(
                    trackingNumber,
                    rogersProvince
                  );
                  expiredPartnersData.push(indentifyPowerQoutes[0]);

                  if (indentifyPowerQoutes[1].length !== 0) {
                    const buildHistoryLogRoger = buildHistoryLogExpire(
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
                  expiredPartnersData.push({
                    name: 'Rogers',
                    offer: serviceCharacteristic,
                    duration: rogersExpiry,
                    code: '006',
                  });
                }
              }

              // if Province not equal to AB and BC, call SHAW API
              debug('calling Shaw API-T');
              const getProvinceOfShaw = await dbRepository.queryProvinceOfShaw();
              const provinceShawFromDb = getProvinceOfShaw.flatMap(
                (row) => row.PROVINCE_ABBREV
              );
              if (provinceShawFromDb.includes(province.toUpperCase())) {
                const tariffsInfo = await _doProcessShawApiRequest(
                  externalApiRequestObject,
                  province
                );

                if (tariffsInfo !== false) {
                  // THIS COMMENT IS FOR TESTING/CHANGING Shaw offer values.
                  // const sample = tariffsInfo.map(param => {
                  //   if (param.Name[0] === 'Coax') {
                  //     param.Value[0] = 'y'
                  //   }
                  //   return param;
                  // });

                  // const sample2 = tariffsInfo.map(params => {
                  //   if (params.Name[0] === 'Fiber') {
                  //     params.Value[0] = 'None'
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
                    debug('from DB', callPartner_OfferDB);
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
                    const xExpiryDate = moment()
                      .add(addDuration, 'days')
                      .format(STANDARD.DATE_FORMAT);

                    expiredPartnersData.push({
                      name: 'Shaw',
                      offer: shawOffer,
                      duration: xExpiryDate,
                      code: '1',
                    });

                    // building collection for Expire True to History LOg
                    const parseAmsDetails = await _amsToHistoryLog(amsAddress);
                    historyLogsDetails.push({
                      parseAmsDetails: parseAmsDetails,
                      offers: callPartner_OfferDB,
                    });
                  } else {
                    debug('This feature is under negotiation status!!!');
                  }
                } else {
                  debug('Shaw Api is down...');
                  const newExpiredate = moment().format(STANDARD.DATE_FORMAT);
                  const serviceCharacteristic = [];
                  expiredPartnersData.push({
                    name: 'Shaw',
                    offer: serviceCharacteristic,
                    duration: newExpiredate,
                    code: '006',
                  });
                }
              }

              // Call BELL API - uncomment this block if BELL is available
              debug('calling Bell API-T');
              const bellProvince = externalApiRequestObject.GEO_PROVINCE;
              const getProvOfBell = await dbRepository.queryProvinceBell();
              const provinceFromDb = getProvOfBell.flatMap(
                (row) => row.PROVINCE_ABBREV
              );

              if (provinceFromDb.includes(bellProvince.toUpperCase())) {
                const bellPresaleProducts = await _doProcessBellApiRequest(
                  externalApiRequestObject
                );
                debug('bellPresaleProducts', bellPresaleProducts);

                const identifyBell = await getIdentifyBell(
                  bellPresaleProducts,
                  bellProvince
                );

                expiredPartnersData.push(identifyBell[0]);

                if (identifyBell[1].length !== 0) {
                  const buildHistoryLogBell = buildHistoryLogExpire(
                    identifyBell[1]
                  );
                  const bellDetailsAms = await _amsToHistoryLog(amsAddress);
                  historyLogsDetails.push({
                    parseAmsDetails: bellDetailsAms,
                    offers: buildHistoryLogBell,
                  });
                }
              }

              debug('calling Videotron API/True...');

              const videotronProvince = externalApiRequestObject.GEO_PROVINCE;
              const getProvOfVideotronT = await dbRepository.queryProvinceVideotron();
              const provinceVideotronT = getProvOfVideotronT.flatMap(
                (row) => row.PROVINCE_ABBREV
              );

              if (provinceVideotronT.includes(videotronProvince)) {
                const videotronAddress = csqNoFootprintProcessor.buildExternalApiRequestObjectVideotron(
                  amsAddress
                );

                const videotronResponse = await csqAbtractService.doProcessVideotronApiRequest(
                  videotronAddress
                );

                debug('videotronResponse', videotronResponse);

                const identifyVideotron = await getIdentifyVideotron(
                  videotronResponse,
                  videotronProvince
                );

                expiredPartnersData.push(identifyVideotron[0]);
                if (identifyVideotron[1].length !== 0) {
                  const buildHistoryLogVideotron = buildHistoryLogExpire(
                    identifyVideotron[1]
                  );
                  const videotronDetailsAms = await _amsToHistoryLog(
                    amsAddress
                  );
                  historyLogsDetails.push({
                    parseAmsDetails: videotronDetailsAms,
                    offers: buildHistoryLogVideotron,
                  });
                }
              }

              // Partner with Email_Enable in Query Province  CR55 - July 8 2021 new implementation(citybase)

              const citybasePartner = await dbRepository.getEmailPartnerCityBasedSearch(
                externalApiRequestObject.GEO_CITY.toUpperCase(),
                externalApiRequestObject.GEO_PROVINCE.toUpperCase()
              );
              const cityBaseEmailPartner = citybasePartner.flatMap(
                (row) => row.PARTNER_NAME
              );

              if (
                cityBaseEmailPartner.length !== 0 ||
                cityBaseEmailPartner !== undefined
              ) {
                for (const iter of cityBaseEmailPartner) {
                  expiredPartnersData.push({
                    name: iter,
                    offer: [],
                    duration: moment().format(STANDARD.DATE_FORMAT),
                  });
                }
              }

              // build expiredItems
              let expiredCounter = 0;
              expiredPartnersData.forEach((partner) => {
                // build relatedParty object
                const relatedParty = _buildRelatedPartyObject(partner.name);
                const apiPartners = partner.name;
                const partnerCode = partner.code;
                // serviceCharacteristic object
                const serviceCharacteristic = [...partner.offer];

                const qualificationResult = identifyQualificationResult(
                  serviceCharacteristic
                );

                // serviceSpecification object
                const serviceSpecification = _findServiceQualItemByPlaceId(
                  csqRequestBody.serviceQualificationItem,
                  expiredLpdsId
                ).service.serviceSpecification;
                const partnerApis = ['Shaw', 'Bell', 'Videotron', 'Rogers'];
                if (partnerApis.includes(apiPartners)) {
                  const itemId = (expiredCounter += 1);
                  const partnerDuration = partner.duration;
                  const expiredItem = formExpiredItem(
                    itemId,
                    partnerCode,
                    partnerDuration,
                    serviceQualItemState,
                    qualificationResult,
                    placesOnnetNearnet,
                    relatedParty,
                    serviceCharacteristic,
                    serviceSpecification
                  );
                  finalExpiredServiceQualItems.push(expiredItem);
                } else {
                  const expiredItem = {
                    id: (expiredCounter += 1),
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
                      place: placesOnnetNearnet,
                      relatedParty,
                      serviceCharacteristic,
                      serviceSpecification,
                    },
                  };
                  finalExpiredServiceQualItems.push(expiredItem);
                }
              });
            }
          } else {
            debug('No Expire processor in Ams..');
          }
        }

        debug(
          'finalExpiredServiceQualItems count:',
          finalExpiredServiceQualItems.length
        );
        resolve({
          emailDetails: emailDetails,
          serviceQualificationItem: finalExpiredServiceQualItems,
          historyLogsDetails: historyLogsDetails,
          isApiDown,
        });
      } catch (err) {
        debug('CSQ ERROR:', err);
        reject({
          processor: 'EXPIRED PROCESSOR',
          status: STATUS.TERMINATED_WITH_ERROR,
          message: err.message,
        });
      }
    })();
  });
};

export default {
  processExpiredItems,
  _buildPlacesFromAmsAddressFalse,
  _generateServiceQualificationItem,
  _buildPlacesFromAmsAddress,
  buildPlacesOnnetNearnet,
  getBuildOnnet,
  getDummmyPowerQuote,
  getTriggerPowerQoutes,
  getPowerQoutes,
  getDummyRfqTrackingNumber,
  getRogersProfile,
  getTrackingNumber,
  getBuildRogersOffer,
  getIndentifyPowerQoutes,
  getIdentifyVideotron,
  getIdentifyBell,
  getDuration,
};
