import createDebug from 'debug';
import path from 'path';
import dbRepository from '../repository/DatabaseRepository';

const debug = createDebug(path.basename(__filename, '.js'));

const mapProvincesAbbrevWithPlaces = (amsAddress, placeRequest, placeId) => {
    const distinctProvinceAbbrevs = [
        ...new Set(amsAddress.Addresses.map((address) => address.province)),
    ];

    debug(`mapping provinces with places: ${distinctProvinceAbbrevs}`);
    const provinceAbbrevWithPlaces = [];
    distinctProvinceAbbrevs.forEach((abbrev) => {
        const places = amsAddress.Addresses.filter((address) => {
            return address.province === abbrev;
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

            const paramPlace = placeRequest.find((place) => place.id === placeId);
            paramPlace.id = placeId;
            const place = {
                ...paramPlace,
                streetNr: streetNumber,
                streetName,
                streetType: streetTypeSuffix,
                city,
                stateOrProvince: province,
                postcode: postalCode,
                country,
            };

            debug(`province with place:`, place);
            return place;
        });
        provinceAbbrevWithPlaces.push({ abbrev, places });
    });

    return provinceAbbrevWithPlaces;
};

const queryGetAllPartnerOffersByProvince = async (provinceAbbrev) => {
    const result = await dbRepository.queryGetAllPartnerOffersByProvince(provinceAbbrev);
    const jsonResult = JSON.parse(result);

    // for logging only. do not return
    const telusOfferNames = jsonResult.map((offer) => {
        return {
            TELUS_OFFER_ID: offer.TELUS_OFFER_ID,
            TELUS_OFFER_NAME: offer.TELUS_OFFER_NAME,
            TELUS_PARTNER_ID: offer.TELUS_PARTNER_ID,
        };
    });
    debug(`offer names: ${telusOfferNames.length}`, telusOfferNames);

    return result;
};

const getAllServiceQualItems = (partnerOffers, places) => {
    return new Promise((resolve) => {
        const serviceQualItems = [];
        let serviceQualificationItemCount = 1;

        JSON.parse(partnerOffers).forEach((data) => {
            const serviceSpecification = {
                id: data.TELUS_OFFER_ID,
                href: `http://placeholder/catalog/off-net/services/${data.TELUS_OFFER_ID}`,
                name: data.TELUS_OFFER_NAME,
                version: data.VERSION,
                '@type': 'ServiceSpecification',
            };

            const serviceQualificationItem = {
                // eslint-disable-next-line no-plusplus
                id: serviceQualificationItemCount++,
                '@type': 'ServiceQualificationItem',
                service: {
                    serviceType: 'business',
                    '@type': 'Service',
                    place: places,
                },
                serviceSpecification,
            };

            serviceQualItems.push(serviceQualificationItem);
        });
        resolve(serviceQualItems);
    });
};

const getAllParsedServiceQualItems = (provinceAbbrevWithPlaces) => {
    return new Promise((resolve) => {
        provinceAbbrevWithPlaces.forEach((provincePlace) => {
            const { abbrev, places } = provincePlace;

            const doParseServiceQualItems = async (places) => {
                const partnerOffers = await queryGetAllPartnerOffersByProvince(abbrev);
                const serviceQualItems = await getAllServiceQualItems(
                    partnerOffers,
                    places
                );
                return serviceQualItems;
            };

            resolve(doParseServiceQualItems(places));
        });
    });
};

/**
 * Removes the element from the request object having an ID that matches the given LPDS ID.
 * @private
 * @function _removeBadPlaceRequest
 * @memberof module:QueryServiceQualificationController
 * @param {Array<Object>} requestObject - The request object.
 * @param {number} lpdsId - The LPDS ID.
 * @returns {Array<Object>} The request object with the element having an ID that matches the given LPDS ID removed.
 */
const removeBadPlaceRequest = (requestObject, lpdsId) => {
    const placeIndex = requestObject.searchCriteria.service.place.findIndex(
        (e) => e.id === lpdsId
    );
    if (placeIndex !== -1)
        requestObject.searchCriteria.service.place.splice(placeIndex, 1);
    return requestObject;
};

export default {
    mapProvincesAbbrevWithPlaces,
    queryGetAllPartnerOffersByProvince,
    getAllServiceQualItems,
    getAllParsedServiceQualItems,
    removeBadPlaceRequest
}