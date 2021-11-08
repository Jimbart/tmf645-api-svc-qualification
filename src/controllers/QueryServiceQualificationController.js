/* eslint-disable consistent-return, no-shadow, no-underscore-dangle */
/**
 * The QueryServiceQualificationController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic reoutes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

import createDebug from 'debug';
import path from 'path';
import Controller from './Controller';
import service from '../services/QueryServiceQualificationService';
import STATUS from '../utils/enums/StatusEnum';
import ERROR_MESSAGE from '../utils/enums/ErrorMessageEnum';
import ADMIN from '../firestore/firestore-config';
import FIRESTORE_DB from '../utils/enums/FirestoreEnum';

const debug = createDebug(path.basename(__filename, '.js'));

// Post Request Use Case 1
const createQueryServiceQualification = async (request, response) => {

  try {
    response = await service.createQueryServiceQualification(request, response);
    const { statusCode, statusMessage } = response.json()

    debug(`RESPONSE FROM SERVICE: statusCode = ${statusCode} | statusMessage = ${statusMessage}`);
    return response;
  } catch (error) {
    debug('QSQ CONTROLLER ERROR:', error.message);
  }

};

const listQueryServiceQualification = async (request, response) => {
  Controller.handleRequest(
    request,
    response,
    service.listQueryServiceQualification
  );
};

const retrieveQueryServiceQualification = async (request, response) => {

  try {
    response = await service.retrieveQueryServiceQualification(request, response);
    const { statusCode, statusMessage } = response.json()

    debug(`RESPONSE FROM SERVICE: statusCode = ${statusCode} | statusMessage = ${statusMessage}`);
    return response;
  } catch (error) {
    debug('QSQ CONTROLLER ERROR:', error.message);
  }

  // await Controller.handleRequest(
  //   request,
  //   response,
  //   service.retrieveQueryServiceQualification
  // );
};

export default {
  createQueryServiceQualification,
  listQueryServiceQualification,
  retrieveQueryServiceQualification,
};
