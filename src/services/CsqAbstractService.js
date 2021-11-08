import moment from 'moment';
import STANDARD from '../utils/enums/StandardEnum';
import createDebug from 'debug';
import path from 'path';
import STATUS from '../utils/enums/StatusEnum';
import VideotronApi from '../vendor_api/VideotronApi';
import dbRepository from '../repository/DatabaseRepository';
import amsApi from '../vendor_api/AmsApi';
import CsqExpiredItemsProcessor from '../services/CsqExpiredItemsProcessor';
import EmailSender from '../email/EmailSender';
import firestoreConfig from '../firestore/firestore-config';
import FIRESTORE_ENUM from '../utils/enums/FirestoreEnum';
import AddressStringBuilder from '../utils/AddressStringBuilder';
import csqNoFootprintProcessor from '../services/CsqNoFootprintProcessor';
import URL from '../utils/enums/UrlEnum';
import firestoreRepository from '../repository/FirestoreRepository';

const debug = createDebug(path.basename(__filename, '.js'));

const buildItemsForHistoryLog = (createdDocId, amsAddress, offers) => {
  const endpointType = '/checkServiceQualification';
  const reqSubmittedOn = moment().format(STANDARD.DATE_FORMAT);
  const partnerRespondedOn = moment().format(STANDARD.DATE_FORMAT);
  const fullAddress = amsAddress.fullAddress;
  const stAddress = amsAddress.stAddress;
  const city = amsAddress.city;
  const province = amsAddress.province;
  const postalCode = amsAddress.postalCode;
  const requestStatus = 200;

  const historyLogItems = offers.map((item) => {
    const partnerOfferName = item.PARTNER_OFFER_NAME;
    const telusOfferNames = item.TELUS_OFFER_NAME;
    const telusOfferingCategory = item.TELUS_OFFERING_CATEGORY;
    const downloadSpeed = item.DL_SPEED.toString();
    const uploadSpeed = item.UP_SPEED.toString();
    const partnerName = item.PARTNER_NAME;
    const contactMode = item.PARTNER_CONTACT_MODE;

    const collection = [
      createdDocId,
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

  return historyLogItems;
};

const revalidateStateAndResponseStatus = (validatedExistingItems) => {
  const {
    isInstantSync,
    isNoFootprintWithoutAmsExists,
    isNoFootprintWithAmsExists,
    isGoodExists,
    isExpiredExists,
  } = validatedExistingItems;

  debug(`isInstantSync: ${isInstantSync}`);
  debug(`isNoFootprintWithoutAmsExists: ${isNoFootprintWithoutAmsExists}`);
  debug(`isNoFootprintWithAmsExists: ${isNoFootprintWithAmsExists}`);
  debug(`isGoodExists: ${isGoodExists}`);
  debug(`isExpiredExists: ${isExpiredExists}`);
  const result = {
    state: 'done',
    responseStatus: 200,
  };

  // SEQUENCE: isInstantSync, isNoFootprintWithoutAmsExists, isNoFootprintWithAmsExists
  const truthTable = {
    done: [
      [true, false, false, true, false], // good , good
      [true, true, true, false, false], //no ams , Nf
      [true, true, false, true, false], //no ams , good
      [true, true, false, false, true], //no ams , x
      [true, false, false, false, true], // x ,x
      [true, false, true, false, false], // nf , nf
    ],
    inProgress: [[false, false, false]],
    terminatedWithError: [
      [true, true, false, false, false], //no ams + no ams,no ams
      [false, true, false],
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

const addressManipulation = (
  GEO_STNUMBER,
  GEO_ST_TYPE_PREFIX,
  GEO_STNAME,
  GEO_STREETTYPESUFFIX,
  DIR_SUFFIX
) => {
  if (GEO_STREETTYPESUFFIX == null && DIR_SUFFIX == null) {
    const xAddress = GEO_STNUMBER + ' ' + GEO_STNAME;
    return xAddress;
  } else if (DIR_SUFFIX == null) {
    const xAddress =
      GEO_STNUMBER + ' ' + GEO_STNAME + ' ' + GEO_STREETTYPESUFFIX.substr(0, 2);
    return xAddress;
  } else if (GEO_STREETTYPESUFFIX == null) {
    const xAddress =
      GEO_STNUMBER +
      ' ' +
      GEO_ST_TYPE_PREFIX +
      ' ' +
      GEO_STNAME +
      ' ' +
      DIR_SUFFIX;
    return xAddress;
  } else if (GEO_ST_TYPE_PREFIX == null && DIR_SUFFIX == null) {
    const xAddress =
      GEO_STNUMBER + ' ' + GEO_STNAME + ' ' + GEO_STREETTYPESUFFIX.substr(0, 2);
    return xAddress;
  } else if (GEO_ST_TYPE_PREFIX == null && GEO_STREETTYPESUFFIX == null) {
    const xAddress = GEO_STNUMBER + ' ' + GEO_STNAME + ' ' + DIR_SUFFIX;
    return xAddress;
  } else {
    const xAddress =
      GEO_STNUMBER +
      ' ' +
      GEO_ST_TYPE_PREFIX +
      ' ' +
      GEO_STNAME +
      ' ' +
      GEO_STREETTYPESUFFIX.substr(0, 2) +
      ' ' +
      DIR_SUFFIX;
    return xAddress;
  }
};

const manipulateCity = (city) => {
  if (city == 'CLARENCE-ROCKLAND') {
    const myCity = 'ROCKLAND';
    return myCity;
  } else {
    const myCity = city;
    return myCity;
  }
};

const doProcessVideotronApiRequest = async (address) => {
  try {
    const {
      GEO_unit,
      GEO_floor,
      GEO_streetNumberPrefix,
      GEO_streetNumber,
      GEO_streetNumberSuffix,
      GEO_dirPrefix,
      GEO_streetTypePrefix,
      GEO_streetName,
      GEO_streetTypeSuffix,
      GEO_dirSuffix,
      GEO_city,
      GEO_province,
      GEO_postalCode,
      GEO_country,
      LATITUDE,
      LONGITUDE,
    } = address;

    const stAddress = [
      GEO_unit,
      GEO_floor,
      GEO_streetNumberPrefix,
      GEO_streetNumber,
      GEO_streetNumberSuffix,
      GEO_dirPrefix,
      GEO_streetTypePrefix,
      GEO_streetName,
      GEO_streetTypeSuffix,
      GEO_dirSuffix,
    ].filter((x) => !!x);

    const manCity = manipulateCity(GEO_city);

    const addressRequest = [
      {
        Address: [stAddress.join(' ')],
        City: [manCity],
        StateCode: [GEO_province],
        Zip: [GEO_postalCode],
        Latitude: [LATITUDE],
        Longitude: [LONGITUDE],
      },
    ];

    debug('CALLING VIDEOTRON API WITH ADDRESS REQUEST:', addressRequest);

    const videotron = new VideotronApi();
    const data = await videotron.getCarrierService(addressRequest);
    return data;
  } catch (error) {
    return error;
  }

  //return videotron.getParsedCarrierServiceData(data);
};

const cleanEmailDetailsFootprint = (emailDetails) => {
  const trimmedEmailDetailsObject = emailDetails.flatMap((data) => {
    return data.PARTNERS.flatMap((offers) => {
      return {
        LPDS_ID: offers.LPDS_ID,
        ADDRESS: offers.ADDRESS,
        PARTNER_NAME: offers.PARTNER_NAME,
      };
    });
  });

  const parsedOffers = emailDetails.flatMap((data) => data.OFFERS);

  const distinctPartnerNames = new Set(
    trimmedEmailDetailsObject.map((data) => data.PARTNER_NAME)
  );

  let cleanEmailDetails = [];
  for (const distinctPartnerName of distinctPartnerNames) {
    const filteredOffer = parsedOffers.filter(
      (data) => data.PARTNER_NAME === distinctPartnerName
    );

    const filteredTrimmedEmailDetails = trimmedEmailDetailsObject.filter(
      (data) => data.PARTNER_NAME === distinctPartnerName
    );

    const lpdsId = trimmedEmailDetailsObject
      .filter((data) => data.PARTNER_NAME === distinctPartnerName)
      .flatMap((data) => data.LPDS_ID);

    cleanEmailDetails.push({
      LPDS_ID: lpdsId,
      RECIPIENT: filteredOffer[0].RECIPIENT,
      PARTNERS: filteredTrimmedEmailDetails,
      OFFERS: filteredOffer,
    });
  }

  return cleanEmailDetails;
};

// this will merge email details with same partner_name value
// merge PARTNERS and OFFERS array values
const cleanEmailDetails = (emailDetails) => {
  const trimmedEmailDetailsObject = emailDetails.flatMap((data) => {
    return data.OFFERS.flatMap((offers) => {
      return {
        LPDS_ID: data.LPDS_ID,
        ADDRESS: data.ADDRESS,
        PARTNER_NAME: offers.PARTNER_NAME,
      };
    });
  });

  const parsedOffers = emailDetails.flatMap((data) => data.OFFERS);

  const distinctPartnerNames = new Set(
    trimmedEmailDetailsObject.map((data) => data.PARTNER_NAME)
  );

  let cleanEmailDetails = [];
  for (const distinctPartnerName of distinctPartnerNames) {
    const filteredOffer = parsedOffers.filter(
      (data) => data.PARTNER_NAME === distinctPartnerName
    );

    const filteredTrimmedEmailDetails = trimmedEmailDetailsObject.filter(
      (data) => data.PARTNER_NAME === distinctPartnerName
    );

    cleanEmailDetails.push({
      RECIPIENT: filteredOffer[0].RECIPIENT,
      PARTNERS: filteredTrimmedEmailDetails,
      OFFERS: filteredOffer,
    });
  }

  return cleanEmailDetails;
};

const getFootprintEmailPartner = async (id) => {
  const iterItem = [];
  const amsAddress = await amsApi.getAddressByLpdsId(id);
  const province = amsAddress.Addresses[0].province;
  const places = CsqExpiredItemsProcessor._buildPlacesFromAmsAddress(
    amsAddress,
    id
  );
  const getOnnetNearnetFootPrint = await dbRepository.queryOnnetNearnet(id);

  const placesOnnetNearnetforEmail = CsqExpiredItemsProcessor.buildPlacesOnnetNearnet(
    places,
    getOnnetNearnetFootPrint
  );

  const footprintEP = await dbRepository.callPartnersInProvinceX(province);

  if (footprintEP.length !== 0 || footprintEP !== undefined) {
    for (const iter of footprintEP) {
      const partnerId = iter.TELUS_PARTNER_ID;
      const partnerName = iter.PARTNER_NAME;

      const footPrintEmailPartner = {
        expirationDate: moment().format(STANDARD.DATE_FORMAT),
        state: 'done',
        qualificationResult: 'unqualified',
        eligibilityunavailabilityreason: [
          {
            code: '003',
            label: 'unknown/inquiry required',
          },
        ],
        service: {
          serviceType: 'business',
          place: placesOnnetNearnetforEmail,
          relatedParty: {
            name: partnerName,
            role: 'Partner',
            '@type': 'RelatedParty',
            '@referredType': 'Organization',
          },
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
      iterItem.push(footPrintEmailPartner);
    }
  }

  return iterItem;
};

const getFootprintEmailProcessor = async (
  lpdsId,
  csqRequestBody,
  createdDocId
) => {
  const collectionItemAttachment = [];
  const emailItemOffer = [];

  const amsAddress = await amsApi.getAddressByLpdsId(lpdsId);
  const province = amsAddress.Addresses[0].province;

  const parseAddress = buildEmailAttachmentObject(amsAddress, lpdsId);
  const address = parseAddress.GEO_STD_ADDRESS;
  let attachment = [];

  //CR47
  const city = amsAddress.Addresses[0].city;
  // sending email
  const offers = await dbRepository.queryGetAllPartnerOffersByProvince(
    province,
    city
  );

  const distinctPartners = new Set(
    JSON.parse(offers).map((data) => data.TELUS_PARTNER_ID)
  );

  // request with related party

  const lpdsIdFromRequestItems = csqRequestBody.serviceQualificationItem
    .map((data) => {
      return data.service.place;
    })
    .filter((data) => data != undefined)
    .flatMap((place) => place)
    .map((place) => place.id);

  const partnerNamesFromRequestItems = csqRequestBody.serviceQualificationItem
    .map((data) => {
      return data.service.relatedParty;
    })
    .filter((data) => data != undefined)
    .flatMap((relatedParty) => relatedParty)
    .map((relParty) => relParty.name);

  if (partnerNamesFromRequestItems.length !== 0) {
    debug('request with related party = ', partnerNamesFromRequestItems);

    const findPartnerInMulitipleSpecifiedEP = csqNoFootprintProcessor.getFindPartnerInMulitipleSpecifiedEP(
      lpdsId,
      lpdsIdFromRequestItems,
      partnerNamesFromRequestItems
    );
    debug(
      'findPartnerInMulitipleSpecifiedEP=',
      findPartnerInMulitipleSpecifiedEP
    );

    const offerNames = JSON.parse(offers)
      .map((offer) => {
        if (
          offer.PARTNER_NAME.toString().toUpperCase() ===
          findPartnerInMulitipleSpecifiedEP.toString().toUpperCase()
        ) {
          return offer.PARTNER_OFFER_NAME;
        }
      })
      .filter((data) => data !== undefined);

    const recipient = JSON.parse(offers).find(
      (offer) =>
        offer.PARTNER_NAME.toString().toUpperCase() ===
        findPartnerInMulitipleSpecifiedEP.toString().toUpperCase()
    );

    attachment.push({
      RECIPIENT: recipient.CONTACT_EMAIL,
      PARTNERS: [
        {
          LPDS_ID: new String(lpdsId).toUpperCase(),
          ADDRESS: new String(address).toUpperCase(),
          PARTNER_NAME: new String(recipient.PARTNER_NAME).toUpperCase(),
        },
      ],
      OFFERS: [
        {
          RECIPIENT: recipient.CONTACT_EMAIL,
          PARTNER_NAME: new String(recipient.PARTNER_NAME).toUpperCase(),
          PROVINCE_ABBREV: new String(province).toUpperCase(),
          OFFER_NAMES: offerNames,
        },
      ],
    });

    const places = CsqExpiredItemsProcessor._buildPlacesFromAmsAddressFalse(
      amsAddress,
      lpdsId
    );
    const getOnnetNearnetFootprintEmail = await dbRepository.queryOnnetNearnet(
      lpdsId
    );
    const placesOnnetNearnetforEmail = CsqExpiredItemsProcessor.buildPlacesOnnetNearnet(
      places,
      getOnnetNearnetFootprintEmail
    );

    const serviceQualItemOnEmail = CsqExpiredItemsProcessor._generateServiceQualificationItem(
      placesOnnetNearnetforEmail,
      new String(recipient.PARTNER_NAME).toUpperCase()
    );
    emailItemOffer.push(serviceQualItemOnEmail);
  } else {
    debug('request with no related party..');
    for (const partnerId of distinctPartners) {
      debug('specific partnerId : ', partnerId);
      // offerNames using partnerId
      const offerNames = JSON.parse(offers)
        .map((offer) => {
          if (offer.TELUS_PARTNER_ID === partnerId) {
            return offer.PARTNER_OFFER_NAME;
          }
        })
        .filter((data) => data !== undefined);

      const recipient = JSON.parse(offers).find(
        (offer) => offer.TELUS_PARTNER_ID === partnerId
      );

      let contactEmail = undefined;

      if (partnerNamesFromRequestItems.length === 0) {
        contactEmail = recipient.CONTACT_EMAIL;
      } else {
        const emailsByPartners = await dbRepository.queryGetVendorEmailByPartnerNames(
          [...new Set(partnerNamesFromRequestItems)]
        );
        contactEmail = emailsByPartners;
      }

      attachment.push({
        RECIPIENT: recipient.CONTACT_EMAIL,
        PARTNERS: [
          {
            LPDS_ID: new String(lpdsId).toUpperCase(),
            ADDRESS: new String(address).toUpperCase(),
            PARTNER_NAME: new String(recipient.PARTNER_NAME).toUpperCase(),
          },
        ],
        OFFERS: [
          {
            RECIPIENT: recipient.CONTACT_EMAIL,
            PARTNER_NAME: new String(recipient.PARTNER_NAME).toUpperCase(),
            PROVINCE_ABBREV: new String(province).toUpperCase(),
            OFFER_NAMES: offerNames,
          },
        ],
      });

      const places = CsqExpiredItemsProcessor._buildPlacesFromAmsAddressFalse(
        amsAddress,
        lpdsId
      );
      const getOnnetNearnetFootPrint = await dbRepository.queryOnnetNearnet(
        lpdsId
      );

      const placesOnnetNearnetforFootPrintEmail = CsqExpiredItemsProcessor.buildPlacesOnnetNearnet(
        places,
        getOnnetNearnetFootPrint
      );
      const serviceQualItemOnEmail = CsqExpiredItemsProcessor._generateServiceQualificationItem(
        placesOnnetNearnetforFootPrintEmail,
        new String(recipient.PARTNER_NAME).toUpperCase()
      );
      emailItemOffer.push(serviceQualItemOnEmail);
    }
  }
  collectionItemAttachment.push(emailItemOffer, attachment);

  return collectionItemAttachment;
};

const removeArrayItemByPropValue = (array, propName, propValue) => {
  const newItems = array.filter((item) => {
    return item[propName] !== propValue;
  });

  return newItems;
};

const buildEmailAttachmentObject = (amsAddress, lpdsId) => {
  const addressBuilder = new AddressStringBuilder();
  addressBuilder
    .setName('streetNumber')
    .setValue(amsAddress.Addresses[0].streetNumber)
    .setName('streetTypePrefix')
    .setValue(amsAddress.Addresses[0].streetTypePrefix)
    .setName('streetName')
    .setValue(amsAddress.Addresses[0].streetName)
    .setName('streetTypeSuffix')
    .setValue(amsAddress.Addresses[0].streetTypeSuffix)
    .setName('dirSuffix')
    .setValue(amsAddress.Addresses[0].dirSuffix)
    .setName('city')
    .setValue(amsAddress.Addresses[0].city)
    .replaceIf('CLARENCE-ROCKLAND', 'ROCKLAND')
    .setName('province')
    .setValue(amsAddress.Addresses[0].province)
    .setName('postalCode')
    .setValue(amsAddress.Addresses[0].postalCode);

  const stAddress = addressBuilder.build();

  debug('_buildEmailAttachmentObject:', stAddress);

  return {
    ID: 1,
    GEO_LOCATIONID: lpdsId,
    GEO_STD_ADDRESS: stAddress,
    GEO_CITY: addressBuilder.getAddress().city,
    GEO_PROVINCE: amsAddress.Addresses[0].province,
    GEO_POSTAL: amsAddress.Addresses[0].postalCode,
  };
};

const getBuildItem = (
  partnerCode,
  expiry_date,
  places,
  relatedParty,
  offer
) => {
  if (partnerCode == '007') {
    const buildRetryItem = {
      expirationDate: expiry_date,
      state: 'done',
      qualificationResult: 'unqualified',
      eligibilityunavailabilityreason: [
        {
          code: '007',
          label: 'No Offers.',
        },
      ],
      service: {
        serviceType: 'business',
        place: places,
        relatedParty: relatedParty,
        serviceCharacteristic: offer,
        serviceSpecification: {
          id: '1',
          href:
            'http://placeholder/off-net/serviceQualificationManagement/v4/ServiceSpecification/1',
          name: 'Off_Net_Unmanaged',
          version: '1.0',
          '@type': 'ServiceSpecification',
        },
      },
    };
    return buildRetryItem;
  } else if (partnerCode == '006') {
    const buildRetryItem = {
      expirationDate: expiry_date,
      state: 'terminatedWithError',
      qualificationResult: 'unqualified',
      eligibilityunavailabilityreason: [
        {
          code: '006',
          label: 'Error detected on Partner side API. Please retry.',
        },
      ],
      service: {
        serviceType: 'business',
        place: places,
        relatedParty: relatedParty,
        serviceCharacteristic: offer,
        serviceSpecification: {
          id: '1',
          href:
            'http://placeholder/off-net/serviceQualificationManagement/v4/ServiceSpecification/1',
          name: 'Off_Net_Unmanaged',
          version: '1.0',
          '@type': 'ServiceSpecification',
        },
      },
    };
    return buildRetryItem;
  } else {
    const buildRetryItem = {
      expirationDate: expiry_date,
      state: 'done',
      qualificationResult: 'qualified',
      service: {
        serviceType: 'business',
        place: places,
        relatedParty: relatedParty,
        serviceCharacteristic: offer,
        serviceSpecification: {
          id: '1',
          href:
            'http://placeholder/off-net/serviceQualificationManagement/v4/ServiceSpecification/1',
          name: 'Off_Net_Unmanaged',
          version: '1.0',
          '@type': 'ServiceSpecification',
        },
      },
    };
    return buildRetryItem;
  }
};

const getReplyFailedApi = async (id, findFootprint) => {
  const retryItem = [];
  const amsAddress = await amsApi.getAddressByLpdsId(id);
  const province = amsAddress.Addresses[0].province;
  const places = CsqExpiredItemsProcessor._buildPlacesFromAmsAddress(
    amsAddress,
    id
  );

  const apiPartnerInProvince = await dbRepository.getApiPartnerInProvince(
    province
  );
  const partnerInProv = apiPartnerInProvince.flatMap((row) => row.PARTNER_NAME);
  debug('apiPartnerInProvince...', partnerInProv);
  const unqualifiedFinder = partnerInProv.filter(
    (x) => !findFootprint.includes(x)
  );
  for (const fallenApi of unqualifiedFinder) {
    // Retry Bell Api
    if (fallenApi == 'BELL') {
      const addressFailed = csqNoFootprintProcessor._buildExternalApiRequestObject(
        amsAddress
      );
      const bellPresaleProducts = await csqNoFootprintProcessor._doProcessBellApiRequest(
        addressFailed
      );
      debug('bellPresaleProducts', bellPresaleProducts);
      const identifyBell = await CsqExpiredItemsProcessor.getIdentifyBell(
        bellPresaleProducts,
        province
      );
      const partnerCode = identifyBell[0].code;
      const bellOffer = identifyBell[0].offer;
      const expiry_date = identifyBell[0].duration;
      const relatedParty = {
        name: 'Bell',
        role: 'Partner',
        '@type': 'RelatedParty',
        '@referredType': 'Organization',
      };

      const buildItem = getBuildItem(
        partnerCode,
        expiry_date,
        places,
        relatedParty,
        bellOffer
      );

      retryItem.push(buildItem);
    }
    // Retry Videotron
    else if (fallenApi == 'VIDEOTRON') {
      const videotronAddress = csqNoFootprintProcessor.buildExternalApiRequestObjectVideotron(
        amsAddress
      );
      const videotronResponse = await doProcessVideotronApiRequest(
        videotronAddress
      );

      debug('videotronResponse', videotronResponse);
      const identifyVideotron = await CsqExpiredItemsProcessor.getIdentifyVideotron(
        videotronResponse,
        province
      );
      const partnerCode = identifyVideotron[0].code;
      const videotronOffer = identifyVideotron[0].offer;
      const expiry_date = identifyVideotron[0].duration;
      const relatedParty = {
        name: 'Videotron',
        role: 'Partner',
        '@type': 'RelatedParty',
        '@referredType': 'Organization',
      };

      const buildItem = getBuildItem(
        partnerCode,
        expiry_date,
        places,
        relatedParty,
        videotronOffer
      );

      retryItem.push(buildItem);
    }

    //Retry Rogers
    else if (fallenApi == 'ROGERS') {
      debug('retry Rogers API...');
      const rogersApiAddress = csqNoFootprintProcessor._buildExternalApiRequestObject(
        amsAddress
      );
      debug('rogersApiAddress', rogersApiAddress);
      const trackingNumber = await CsqExpiredItemsProcessor.getTrackingNumber(
        rogersApiAddress,
        URL.CONFIG_STRING_1000
      );
      debug('trackingNumber..', trackingNumber);
      if (trackingNumber !== undefined) {
        await csqNoFootprintProcessor.delay();

        const indentifyPowerQoutes = await CsqExpiredItemsProcessor.getIndentifyPowerQoutes(
          trackingNumber,
          province
        );
        //debug('indentifyPowerQoutes', indentifyPowerQoutes[0]);
        const rogersExpiry = indentifyPowerQoutes[0].duration;
        const buildRogersOffer = indentifyPowerQoutes[0].offer;
        const partnerCode = indentifyPowerQoutes[0].code;

        const relatedParty = {
          name: 'Rogers',
          role: 'Partner',
          '@type': 'RelatedParty',
          '@referredType': 'Organization',
        };

        const buildItem = getBuildItem(
          partnerCode,
          rogersExpiry,
          places,
          relatedParty,
          buildRogersOffer
        );
        retryItem.push(buildItem);
      } else {
        debug('Rogers Api is down..');
        const newExpiredate = moment().format(STANDARD.DATE_FORMAT);
        const serviceCharacteristic = [];
        const partnerCode = '006';
        const relatedParty = {
          name: 'Rogers',
          role: 'Partner',
          '@type': 'RelatedParty',
          '@referredType': 'Organization',
        };
        const buildItem = getBuildItem(
          partnerCode,
          newExpiredate,
          places,
          relatedParty,
          serviceCharacteristic
        );
        retryItem.push(buildItem);
      }
    }

    // Retry Shaw
    else if (fallenApi == 'SHAW') {
      const retryShawAddress = csqNoFootprintProcessor._buildExternalApiRequestObject(
        amsAddress
      );
      const tariffsInfo = await csqNoFootprintProcessor._doProcessShawApiRequest(
        retryShawAddress,
        province
      );

      if (tariffsInfo !== false) {
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

        if (locTypeValue !== 'On-Net' && (fiber != 'None' || coax != 'None')) {
          const callPartner_OfferDB = await csqNoFootprintProcessor._handleShawTrueApitoDB(
            coax,
            fiber,
            province
          );
          debug('this is for No FootPrint query from DB', callPartner_OfferDB);
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

          const shawDuration = await dbRepository.vendorDurationQuery('Shaw');
          const addDuration = shawDuration.map((row) => row.FOOTPRINT_DURATION);
          const expiryDate = moment()
            .add(addDuration, 'days')
            .format(STANDARD.DATE_FORMAT);
          const partnerCode = '1';
          const relatedParty = {
            name: 'Shaw',
            role: 'Partner',
            '@type': 'RelatedParty',
            '@referredType': 'Organization',
          };

          const buildItem = getBuildItem(
            partnerCode,
            expiryDate,
            places,
            relatedParty,
            shawOffer
          );
          retryItem.push(buildItem);
        } else {
          debug('This feature is under negotiation status!!!!!!!!!!');
        }
      } else {
        debug('Shaw Api is down..');
        const newExpiredate = moment().format(STANDARD.DATE_FORMAT);
        const serviceCharacteristic = [];
        const partnerCode = '006';
        const relatedParty = {
          name: 'Shaw',
          role: 'Partner',
          '@type': 'RelatedParty',
          '@referredType': 'Organization',
        };
        const buildItem = getBuildItem(
          partnerCode,
          newExpiredate,
          places,
          relatedParty,
          serviceCharacteristic
        );
        retryItem.push(buildItem);
      }
    }
  }
  return retryItem;
};

const getInstantSyncFalseImplementation = async (
  createdDocId,
  csqRequestBody,
  isProvideAlternative
) => {
  const getFootprint = await firestoreRepository.getFootprintSyncFalse();
  const footprint = getFootprint.docs.map((doc) => doc.data());

  const lpdsIdFromRequestItems = csqRequestBody.serviceQualificationItem
    .map((data) => {
      return data.service.place;
    })
    .filter((data) => data != undefined)
    .flatMap((place) => place)
    .map((place) => place.id);

  const mapIdandRelatedEp = [];
  for (const x of csqRequestBody.serviceQualificationItem) {
    const parseId = x.service.place[0].id;
    if (x.service.relatedParty !== undefined) {
      const parseEmailPartner = x.service.relatedParty[0].name;
      const mapIdandRelatedEpObject = {
        id: parseId,
        partner: parseEmailPartner,
      };
      const index = lpdsIdFromRequestItems.indexOf(mapIdandRelatedEpObject.id);
      if (index > -1) {
        lpdsIdFromRequestItems.splice(index, 1);
      }

      mapIdandRelatedEp.push(mapIdandRelatedEpObject);
    }
  }
  const serviceSpecification = {
    id: 1,
    href:
      'http://placeholder/off-net/serviceQualificationManagement/v4/ServiceSpecification/1',
    name: 'Off_Net_Unmanaged',
    version: '1.0',
    '@type': 'ServiceSpecification',
  };
  const rawServiceQualItem = [];
  let idNumber = 0;

  for (const parseEp of mapIdandRelatedEp) {
    const formServiceQualItem = {
      id: (idNumber += 1),
      qualificationResult: 'unqualified',
      expirationDate: moment().format(STANDARD.DATE_FORMAT),
      state: 'inProgress',
      service: {
        place: [{ id: parseEp.id }],
        serviceType: 'business',
        relatedParty: {
          name: parseEp.partner,
          role: 'Partner',
          '@type': 'RelatedParty',
          '@referredType': 'Organization',
        },
        serviceCharacteristic: [],
        serviceSpecification: serviceSpecification,
      },
    };
    rawServiceQualItem.push(formServiceQualItem);
  }

  for (const parseId of lpdsIdFromRequestItems) {
    try {
      const amsAddress = await amsApi.getAddressByLpdsId(parseId);
      const province = amsAddress.Addresses[0].province;
      const city = amsAddress.Addresses[0].city;
      debug('province and city', province + ' and ' + city);

      const cityBase = await dbRepository.getAPIEmailPartnerCityBasedSearch(
        city.toUpperCase(),
        province.toUpperCase()
      );
      const cityBaseEmailPartner = cityBase.flatMap((row) => row.PARTNER_NAME);
      debug('cityBaseEmailPartner', cityBaseEmailPartner);
      for (const parseEmailVendor of cityBaseEmailPartner) {
        const formServiceQualItem = {
          id: (idNumber += 1),
          qualificationResult: 'unqualified',
          expirationDate: moment().format(STANDARD.DATE_FORMAT),
          state: 'inProgress',
          eligibilityunavailabilityreason: [
            {
              code: '003',
              label: 'unknown/inquiry required',
            },
          ],
          service: {
            place: [{ id: parseId }],
            serviceType: 'business',
            relatedParty: {
              name: parseEmailVendor,
              role: 'Partner',
              '@type': 'RelatedParty',
              '@referredType': 'Organization',
            },
            serviceCharacteristic: [],
            serviceSpecification: serviceSpecification,
          },
        };
        rawServiceQualItem.push(formServiceQualItem);
      }
    } catch (error) {
      debug('lpdsId not found in AMS:', parseId);
    }
  }

  const parseGoodServiceQualItems = footprint.flatMap((data) => {
    return data.serviceQualificationItem
      .flatMap((item) => {
        const isOnNet =
          item.service.serviceSpecification.name.toString().toUpperCase() ===
          'On-Net Location'.toUpperCase();

        if (
          isOnNet ||
          moment(item.expirationDate).isAfter(
            moment().format(STANDARD.DATE_FORMAT)
          )
        ) {
          return item.service.place.flatMap((place) => {
            return {
              doc_id: data.id,
              serviceQualificationItem: item,
              lpds_id: place.id.toString(),
              isOnNet: isOnNet,
            };
          });
        }
      })
      .filter((data) => {
        if (data != undefined) {
          return lpdsIdFromRequestItems.toString().includes(data.lpds_id);
        }
      });
  });
  debug('parseGoodServiceQualItems', parseGoodServiceQualItems);

  const goodFootprint = [];
  let groupSameId;
  for (let lpdsId of lpdsIdFromRequestItems) {
    groupSameId = [];
    for (const item of parseGoodServiceQualItems) {
      if (lpdsId == item.lpds_id) {
        groupSameId.push(item.serviceQualificationItem);
      }
    }
    const vendor = await dbRepository.selectAllPartner();
    const mapVendor = vendor.flatMap((row) => row.PARTNER_NAME);
    const filterUniqueVendor = mapVendor[Symbol.iterator]();
    for (const filterVendor of filterUniqueVendor) {
      const iterItem = groupSameId[Symbol.iterator]();
      for (const pickitem of iterItem) {
        if (
          pickitem.service.relatedParty.name.toString().toUpperCase() ===
          filterVendor.toString().toUpperCase()
        ) {
          goodFootprint.push(pickitem);
          break;
        }
      }
    }
  }

  for (const parseItem of goodFootprint) {
    const euReason =
      parseItem.eligibilityunavailabilityreason != undefined
        ? parseItem.eligibilityunavailabilityreason
        : ' ';
    const buildItem = {
      id: (idNumber += 1),
      qualificationResult: parseItem.qualificationResult,
      expirationDate: parseItem.expirationDate,
      state: parseItem.state,
      eligibilityunavailabilityreason: euReason,
      service: parseItem.service,
    };
    rawServiceQualItem.push(buildItem);
  }

  firestoreRepository.addEntryAsyncFalse(
    isProvideAlternative,
    mapIdandRelatedEp,
    createdDocId,
    lpdsIdFromRequestItems
  );

  const csqFalsePayload = {
    id: createdDocId,
    href:
      '/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification/' +
      createdDocId,
    checkServiceQualificationDate: moment().format(STANDARD.DATE_FORMAT),
    effectiveQualificationDate: moment().format(STANDARD.DATE_FORMAT),
    state: 'inProgress',
    description: 'Initial Technical Eligibility',
    externalId: csqRequestBody.externalId,
    provideAlternative: isProvideAlternative,
    instantSyncQualification: csqRequestBody.instantSyncQualification,
    serviceQualificationItem: rawServiceQualItem,
  };
  return csqFalsePayload;
};

export default {
  buildItemsForHistoryLog,
  revalidateStateAndResponseStatus,
  doProcessVideotronApiRequest,
  cleanEmailDetails,
  addressManipulation,
  manipulateCity,
  getFootprintEmailPartner,
  getFootprintEmailProcessor,
  cleanEmailDetailsFootprint,
  removeArrayItemByPropValue,
  buildEmailAttachmentObject,
  getReplyFailedApi,
  getInstantSyncFalseImplementation,
};
