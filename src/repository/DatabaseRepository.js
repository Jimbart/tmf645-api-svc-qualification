import * as dbServer from '../dbServer';
import createDebug from 'debug';
import path from 'path';
const util = require('util');
const debug = createDebug(path.basename(__filename, '.js'));

// Centralized Database transactions
// method prefixes: (query = select, add = insert, update = update, delete = delete)
const queryGetAllPartnerOffersByProvince = async (
  provinceAbbrev,
  cityCoverage = undefined
) => {
  const connection = await dbServer.getConnection();
  return new Promise((resolve, reject) => {
    //CR47 CITY BASED
    //select via city in partner coverage, if null select via province
    //default parameter value of city : undefined
    connection.query(
      'CALL SP_GET_PARTNER_OFFERS_BY_CITY_OR_PROVINCE(?, ?)',
      [cityCoverage, provinceAbbrev],
      (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(
            `error getting partner offers by province with message: ${error.message}`
          );
          return reject(error);
        }
        resolve(JSON.stringify(result[0]));
      }
    );
  });
};

const addEntryToHistoryLog = async (collectionForReporting) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      'INSERT INTO HISTORY_LOG (REQUEST_ID,PARTNER_OFFERING_NAME,TELUS_OFFERING_NAME,TELUS_OFFERING_CATEGORY,DL_SPEED,UP_SPEED,ENDPOINT_TYPE,PARTNER_NAME,REQUEST_SUBMITTED_ON,PARTNER_RESPONDED_ON,PARTNER_CONTACT_MODE,FULL_ADDRESS,ST_ADDRESS,CITY,PROVINCE,POSTAL_CODE,REQUEST_STATUS) VALUES ? ';

    const values = collectionForReporting;

    return new Promise((resolve, reject) => {
      connection.query(sql, [values], function (error, result) {
        dbServer.close(connection);
        if (error) {
          debug(`addEntryToHistoryLog error with message: ${error.message}`);
          return reject(error);
        }
        debug('Number of records inserted: ' + JSON.parse(result.affectedRows));
        resolve(JSON.stringify(result));
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const addError_Log = async (passMessageCode) => {
  try {
    const connection = await dbServer.getConnection();

    const sql = `INSERT INTO ERROR_LOG (ERROR_MESSAGE,ERROR_CODE) VALUES (?,?)`;

    const values = passMessageCode;

    return new Promise((resolve, reject) => {
      connection.query(sql, values, function (error, result) {
        dbServer.close(connection);
        if (error) {
          debug(`add Error_Log error with message: ${error.message}`);
          return reject(error);
        }
        debug('Error_Log inserted: ' + JSON.parse(result.affectedRows));
        resolve(JSON.stringify(result));
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const queryGetEmailFormat = async () => {
  const connection = await dbServer.getConnection();
  const queryString = `SELECT * FROM EMAIL_FORMAT ORDER BY UPDATED_DATE DESC LIMIT 1`;

  return new Promise((resolve, reject) => {
    connection.query(queryString, (error, result) => {
      dbServer.close(connection);
      if (error) {
        debug(
          `error getting email_format table data with message: ${error.message}`
        );
        return reject(error);
      }

      resolve(result[0]);
    });
  });
};

const selectAllPartner = async () => {
  const connection = await dbServer.getConnection();
  const queryString = `SELECT PARTNER_NAME from PARTNERS WHERE PARTNER_STATUS = 'Active'`;

  return new Promise((resolve, reject) => {
    connection.query(queryString, (error, result) => {
      dbServer.close(connection);
      if (error) {
        debug(
          `there was something wrong on the query to database: ${error.message}`
        );
        return reject(error);
      }

      resolve(result);
    });
  });
};

const queryGetVendorEmailByPartnerNames = async (partnerNames) => {
  const connection = await dbServer.getConnection();
  const partnerOffersQueryString = `SELECT DISTINCT CONTACT_EMAIL FROM PARTNERS 
  WHERE UPPER(PARTNER_NAME) IN (${connection.escape(partnerNames)})`;

  return new Promise((resolve, reject) => {
    connection.query(partnerOffersQueryString, (error, result) => {
      dbServer.close(connection);
      if (error) {
        debug(
          `error getting vendor emails by partner names with message: ${error.message}`
        );
        return reject(error);
      }

      const emails = result
        .map((data) => data.CONTACT_EMAIL)
        .filter((data) => data !== undefined);

      resolve(emails);
    });
  });
};

const queryGetVendorEmailByProvinceAbbrev = async (provinceAbbrev) => {
  const connection = await dbServer.getConnection();
  const partnerOffersQueryString = `SELECT DISTINCT CONTACT_EMAIL FROM PARTNERS 
  INNER JOIN PARTNER_OFFERS 
  ON PARTNERS.TELUS_PARTNER_ID = PARTNER_OFFERS.TELUS_PARTNER_ID 
  WHERE PROVINCE_ABBREV = (${connection.escape(provinceAbbrev)})`;

  return new Promise((resolve, reject) => {
    connection.query(partnerOffersQueryString, (error, result) => {
      dbServer.close(connection);
      if (error) {
        debug(
          `error getting vendor emails by province with message: ${error.message}`
        );
        return reject(error);
      }

      const emails = result
        .map((data) => data.CONTACT_EMAIL)
        .filter((data) => data !== undefined);

      resolve(emails);
    });
  });
};

const queryToConfirmIfLpdsIdIsOnnet = async (nfLpdsID) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      `SELECT GEO_ST_NUMBER,GEO_ST_NAME,GEO_CITY,GEO_PROVINCE,GEO_POSTAL_CODE FROM PARTNER_ONNET_LOCATIONS WHERE TELUS_PARTNER_ID = 'TPSP02' AND LPDS_ID =` +
      connection.escape(nfLpdsID);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`addEntryToHistoryLog error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

//CR 58

const queryOnnetNearnet = async (expiredLpdsId) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      'SELECT PARTNER_ADDRESS_TYPE FROM PARTNER_ONNET_LOCATIONS WHERE LPDS_ID =' +
      connection.escape(expiredLpdsId);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`Something is wrong in the query: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const queryToGetOfferFromShaw = async (findProvince) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      `SELECT TECHNOLOGY,TELUS_OFFER_ID,PARTNER_OFFER_NAME,SPEED FROM PARTNER_OFFERS 
      WHERE PARTNER_OFFER_STATUS = 'Active' AND PARTNER_OFFER_NAME LIKE 'SHAW%' AND PROVINCE_ABBREV =` +
      connection.escape(findProvince);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`addEntryToHistoryLog error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const vendorDurationQuery = async (findProvince) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      'SELECT FOOTPRINT_DURATION FROM PARTNERS WHERE PARTNER_NAME =' +
      connection.escape(findProvince);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`Query error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const emailEnablePartnerDurationQuery = async (partnerId) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      'SELECT FOOTPRINT_DURATION FROM PARTNERS WHERE TELUS_PARTNER_ID =' +
      connection.escape(partnerId);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`Query error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const queryProvinceOfShaw = async () => {
  try {
    const connection = await dbServer.getConnection();

    const sql = `SELECT DISTINCT PROVINCE_ABBREV FROM PARTNER_OFFERS WHERE CONTACT_MODE = 'API' and PARTNER_OFFER_NAME LIKE 'SHAW%'`;

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`Query error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const queryProvinceBell = async () => {
  try {
    const connection = await dbServer.getConnection();

    const sql = `SELECT DISTINCT PROVINCE_ABBREV FROM PARTNER_OFFERS WHERE CONTACT_MODE = 'API' AND TELUS_PARTNER_ID  = 'TPSP01';`;

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`Query error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const queryProvinceVideotron = async () => {
  const sql = `SELECT DISTINCT PROVINCE_ABBREV FROM PARTNER_OFFERS WHERE CONTACT_MODE = 'API' AND TELUS_PARTNER_ID  = 'TPSP03';`;
  const connection = await dbServer.getConnection();
  const query = util.promisify(connection.query).bind(connection);
  try {
    const result = await query(sql);
    return result;
  } catch (error) {
    debug('something is wrong with query:', error);
  } finally {
    connection.end();
  }
};

const queryRogersProvince = async () => {
  try {
    const connection = await dbServer.getConnection();

    const sql = `SELECT DISTINCT PROVINCE_ABBREV FROM PARTNER_OFFERS WHERE CONTACT_MODE = 'API' AND TELUS_PARTNER_ID  = 'TPSP05';`;

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`Query error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const bellDurationQuery = async (vendor) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      'SELECT FOOTPRINT_DURATION FROM PARTNERS WHERE PARTNER_NAME =' +
      connection.escape(vendor);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`Query error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const rogersDurationQuery = async (vendor) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      'SELECT FOOTPRINT_DURATION FROM PARTNERS WHERE PARTNER_NAME =' +
      connection.escape(vendor);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`Query error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const queryToGetOfferFromShawForExpire = async (findProvinceX) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      "SELECT TELUS_OFFER_ID,PARTNER_OFFER_NAME,SPEED FROM PARTNER_OFFERS WHERE PARTNER_OFFER_NAME LIKE 'SHAW%' AND PROVINCE_ABBREV =" +
      connection.escape(findProvinceX);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`addEntryToHistoryLog error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const queryVideotronOffer = async (findProvince) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      `SELECT CONTACT_MODE,TELUS_PARTNER_ID,PO_UL_SPEED,PO_DL_SPEED,TELUS_OFFERING_CATEGORY,PARTNER_OFFER_STATUS,
      TELUS_OFFER_NAME,TELUS_OFFER_ID,PARTNER_OFFER_NAME,SPEED,TECHNOLOGY FROM PARTNER_OFFERS 
      WHERE PARTNER_OFFER_STATUS = 'Active' AND TELUS_PARTNER_ID = 'TPSP03' AND PROVINCE_ABBREV =` +
      connection.escape(findProvince);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`query has error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const queryBellOffer = async (findProvince, speed) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      `SELECT CONTACT_MODE,TELUS_PARTNER_ID,PO_UL_SPEED,PO_DL_SPEED,TELUS_OFFERING_CATEGORY,
      PARTNER_OFFER_STATUS,TELUS_OFFER_NAME,TELUS_OFFER_ID,PARTNER_OFFER_NAME,SPEED,TECHNOLOGY FROM PARTNER_OFFERS 
      WHERE PARTNER_OFFER_STATUS = 'Active' AND PROVINCE_ABBREV = ` +
      connection.escape(findProvince) +
      `AND TELUS_PARTNER_ID ='TPSP01' AND PO_DL_SPEED <=` +
      connection.escape(speed);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`query has error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const getRogersPartnerOffers = async (findProvince, speed) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      `SELECT CONTACT_MODE,TELUS_PARTNER_ID,PO_UL_SPEED,PO_DL_SPEED,TELUS_OFFERING_CATEGORY,PARTNER_OFFER_STATUS,TELUS_OFFER_NAME,TELUS_OFFER_ID,
    PARTNER_OFFER_NAME,SPEED,TECHNOLOGY FROM PARTNER_OFFERS 
    WHERE PARTNER_OFFER_STATUS = 'Active' AND PROVINCE_ABBREV = ` +
      connection.escape(findProvince) +
      `AND TELUS_PARTNER_ID ='TPSP05' AND PO_DL_SPEED <=` +
      connection.escape(speed);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`query has error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const callPartnersInProvinceX = async (partnerProv) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      `SELECT DISTINCT P.TELUS_PARTNER_ID, P.PARTNER_NAME FROM PARTNERS P
    INNER JOIN PARTNER_OFFERS PO
    ON P.TELUS_PARTNER_ID = PO.TELUS_PARTNER_ID
    WHERE CONTACT_MODE = 'EMAIL' AND PO.PROVINCE_ABBREV =` +
      connection.escape(partnerProv);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`query has error with message: ${error.message}`);
          return reject(error);
        }
        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const getPartnerOfferCr55 = async (partnerId, partnerProv) => {
  try {
    const connection = await dbServer.getConnection();

    const sql =
      `SELECT TELUS_OFFER_ID,PARTNER_OFFER_NAME,SPEED,TECHNOLOGY FROM PARTNER_OFFERS WHERE PROVINCE_ABBREV =` +
      connection.escape(partnerProv) +
      `AND CONTACT_MODE = 'EMAIL' AND TELUS_PARTNER_ID =` +
      connection.escape(partnerId);

    return new Promise((resolve, reject) => {
      connection.query(sql, (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(`query has error with message: ${error.message}`);
          return reject(error);
        }

        resolve(result);
      });
    });
  } catch (error) {
    debug(error.message);
  }
};

const getApiPartnerInProvince = async (province) => {
  const connection = await dbServer.getConnection();
  const sql =
    `SELECT DISTINCT PARTNER_NAME FROM PARTNERS INNER JOIN PARTNER_OFFERS ON PARTNERS.TELUS_PARTNER_ID = PARTNER_OFFERS.TELUS_PARTNER_ID 
  WHERE CONTACT_MODE = 'API' AND PROVINCE_ABBREV =` +
    connection.escape(province);

  const query = util.promisify(connection.query).bind(connection);
  try {
    const result = await query(sql);
    return result;
  } catch (error) {
    debug('something is wrong with query:', error);
  } finally {
    connection.end();
  }
};

const getEmailPartnerCityBasedSearch = async (
  cityCoverage,
  provinceAbbrev,
  partnerName = ''
) => {
  const connection = await dbServer.getConnection();
  return new Promise((resolve, reject) => {
    //CR47 CITY BASED
    //select via city in partner coverage, if null select via province
    //default parameter value of city : undefined
    connection.query(
      'CALL SP_EMAIL_PARTNER_CITY_BASED_SEARCH(?, ?, ?)',
      [cityCoverage, provinceAbbrev, partnerName],
      (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(
            `error getting partner offers by province with message: ${error.message}`
          );
          return reject(error);
        }
        resolve(result[0]);
      }
    );
  });
};

const getAPIEmailPartnerCityBasedSearch = async (
  cityCoverage,
  provinceAbbrev,
  partnerName = ''
) => {
  const connection = await dbServer.getConnection();
  return new Promise((resolve, reject) => {
    //CR47 CITY BASED
    //select via city in partner coverage, if null select via province
    //default parameter value of city : undefined
    connection.query(
      'CALL SP_GET_ALL_PARTNER_API_AND_EMAIL_CITY_BASED(?, ?, ?)',
      [cityCoverage, provinceAbbrev, partnerName],
      (error, result) => {
        dbServer.close(connection);
        if (error) {
          debug(
            `error getting partner offers by province with message: ${error.message}`
          );
          return reject(error);
        }
        resolve(result[0]);
      }
    );
  });
};

export default {
  queryGetAllPartnerOffersByProvince,
  addEntryToHistoryLog,
  queryGetEmailFormat,
  queryGetVendorEmailByPartnerNames,
  queryGetVendorEmailByProvinceAbbrev,
  queryToConfirmIfLpdsIdIsOnnet,
  queryToGetOfferFromShaw,
  queryToGetOfferFromShawForExpire,
  queryVideotronOffer,
  vendorDurationQuery,
  addError_Log,
  selectAllPartner,
  queryBellOffer,
  bellDurationQuery,
  queryProvinceOfShaw,
  queryProvinceBell,
  callPartnersInProvinceX,
  getPartnerOfferCr55,
  emailEnablePartnerDurationQuery,
  queryRogersProvince,
  getRogersPartnerOffers,
  rogersDurationQuery,
  queryOnnetNearnet,
  queryProvinceVideotron,
  getApiPartnerInProvince,
  getEmailPartnerCityBasedSearch,
  getAPIEmailPartnerCityBasedSearch,
};
