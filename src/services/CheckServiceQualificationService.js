/* eslint-disable no-unused-vars */
import Service from './Service';
import createDebug from 'debug';
import path from 'path';
import firestoreRepository from '../repository/FirestoreRepository';
import firestoreConfig from '../firestore/firestore-config';
import FIRESTORE_ENUM from '../utils/enums/FirestoreEnum';
import ERROR_MESSAGE from '../utils/enums/ErrorMessageEnum';
import STATUS from '../utils/enums/StatusEnum';
import STANDARD from '../utils/enums/StandardEnum';
import URL from '../utils/enums/UrlEnum';
import checkServiceQualificationSchema from '../model/CheckServiceQualification';
import moment from 'moment';
import csqExpiredProcessor from './CsqExpiredItemsProcessor';
import csqNoFootprintProcessor from './CsqNoFootprintProcessor';
import EmailSender from '../email/EmailSender';
import csqAbstractService from './CsqAbstractService';
import dbRepository from '../repository/DatabaseRepository';
import csqAbtractService from '../services/CsqAbstractService';

const debug = createDebug(path.basename(__filename, '.js'));
/**
 * Creates a CheckServiceQualification
 * This operation creates a CheckServiceQualification entity.
 *
 * checkServiceQualification CheckServiceQualificationCreate The CheckServiceQualification to be created
 * returns CheckServiceQualification
 * */
const createCheckServiceQualification = async (request, response) => {
  let createdDocId;

  try {
    createdDocId = await firestoreRepository.addBlankFirestoreDoc(
      FIRESTORE_ENUM.CSQ_SCHEMA
    );

    const csqRequestBody = await checkServiceQualificationSchema.validateAsync(
      request.body
    );

    const finalServiceQualificationItems = [];

    const isInstantSync = csqRequestBody.instantSyncQualification;
    const isProvideAlternative = csqRequestBody.provideAlternative;

    let isGoodExists = false;
    let isExpiredExists = false;
    let isNoFootprintWithAmsExists = false;
    let isNoFootprintWithoutAmsExists = false;
    let isApiDown = false;

    const finalStateAndResponseStatus = csqAbstractService.revalidateStateAndResponseStatus(
      {
        isInstantSync,
        isNoFootprintWithoutAmsExists,
        isNoFootprintWithAmsExists,
      }
    );

    if (isInstantSync == false) {
      debug('isInstantSync..........', isInstantSync);
      const instantSyncFalseImplementation = await csqAbtractService.getInstantSyncFalseImplementation(
        createdDocId,
        csqRequestBody,
        isProvideAlternative
      );
      debug(
        'instantSyncFalseImplementation.....',
        instantSyncFalseImplementation
      );
      const csqEmptryDocument = firestoreConfig
        .collection(FIRESTORE_ENUM.CSQ_SCHEMA)
        .doc(createdDocId);
      await csqEmptryDocument.set(instantSyncFalseImplementation);

      response
        .status(finalStateAndResponseStatus.responseStatus)
        .json(instantSyncFalseImplementation);
    } else {
      debug(`isInstantSync: ${isInstantSync}`);
      const serviceQualItemFromRequest =
        csqRequestBody.serviceQualificationItem;

      // using 'let' here to compute and re-assign remaining lpds_ids
      let lpdsIdsFromRequest = serviceQualItemFromRequest.flatMap((item) => {
        return item.service.place.flatMap((place) => place.id.toString());
      });

      // query csq data firestore
      const csqDocMap = await firestoreConfig
        .collection(FIRESTORE_ENUM.CSQ_SCHEMA)
        .where('state', '==', 'done')
        .orderBy('effectiveQualificationDate', 'desc')
        .get();

      const csqData = csqDocMap.docs.map((doc) => doc.data());

      // Good items processing
      debug('good item lpds_ids processing...');
      const parseGoodServiceQualItems = csqData.flatMap((data) => {
        return data.serviceQualificationItem
          .flatMap((item) => {
            const isOnNet =
              item.service.serviceSpecification.name
                .toString()
                .toUpperCase() === 'On-Net Location'.toUpperCase();

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
              return lpdsIdsFromRequest.includes(data.lpds_id);
            }
          });
      });

      // get all unique good items. finding latest single item.
      const goodServiceQualItems = [];
      const outerFind = [];
      const filterFootprintId = [];
      const findFootprint = [];
      for (let lpdsId of lpdsIdsFromRequest) {
        const item = parseGoodServiceQualItems.filter(
          (data) => data.lpds_id === lpdsId
        );

        const parse = item.flatMap((row) => row.serviceQualificationItem);

        const vendor = await dbRepository.selectAllPartner();
        const mapVendor = vendor.flatMap((row) => row.PARTNER_NAME);
        const filterUniqueVendor = mapVendor[Symbol.iterator]();
        for (const filterVendor of filterUniqueVendor) {
          debug('vendor.....', filterVendor);
          const filterParse = parse[Symbol.iterator]();
          for (const resultParse of filterParse) {
            //debug('resultParse......', resultParse);
            if (
              resultParse.service.relatedParty.name.toUpperCase() ===
              filterVendor.toUpperCase()
            ) {
              debug(
                'resultParse.service.relatedParty.name....',
                resultParse.service.relatedParty.name
              );

              outerFind.push(resultParse);
              findFootprint.push(
                resultParse.service.relatedParty.name.toUpperCase()
              );
              if (
                resultParse.service.serviceSpecification.name !==
                'On-Net Location'
              ) {
                filterFootprintId.push(resultParse.service.place[0].id);
              }

              break;
            }
          }
        }
      }

      // redesign Footprint CR-71

      if (outerFind != 0 && isInstantSync == true) {
        const distinctLpdsid = [...new Set(filterFootprintId)];
        for (const filterLpdsId of distinctLpdsid) {
          const footprintEmailPartner = await csqAbtractService.getFootprintEmailPartner(
            filterLpdsId
          );
          outerFind.push(...footprintEmailPartner);
        }
        for (const failedId of distinctLpdsid) {
          const replyFailedApi = await csqAbtractService.getReplyFailedApi(
            failedId,
            findFootprint
          );
          outerFind.push(...replyFailedApi);
          debug('replyFailedApi', replyFailedApi);
        }
      } else if (outerFind != 0 && isInstantSync == false) {
        const distinctLpdsid = [...new Set(filterFootprintId)];

        const collectionAttachment = [];
        for (const filterLpdsId of distinctLpdsid) {
          const confirmingEmailInProgressExist = await firestoreConfig
            .collection(FIRESTORE_ENUM.EMAIL_SCHEMA)
            .where('lpdsId', '==', filterLpdsId)
            .get();
          const dataList = confirmingEmailInProgressExist.docs.map((doc) =>
            doc.data()
          );

          const filterInprogress = dataList.map((row) => row.email_inProgress);

          if (filterInprogress.includes('inProgress')) {
            debug('LPDSID has an EMAIL in progress');
            // Cr56
            const footprintEmailProcessor = await csqAbtractService.getFootprintEmailProcessor(
              filterLpdsId,
              csqRequestBody,
              createdDocId
            );
            debug('footprintEmailProcessor', footprintEmailProcessor);
            outerFind.push(...footprintEmailProcessor[0]);
            // CR56-B
            debug('updating request doc ids...');
            const updateRequestDocIds = await firestoreRepository.updateReqDocIdsEmailStatusDoc(
              confirmingEmailInProgressExist.docs[0].id,
              createdDocId
            );
          } else {
            const footprintEmailProcessor = await csqAbtractService.getFootprintEmailProcessor(
              filterLpdsId,
              csqRequestBody,
              createdDocId
            );
            debug('footprintEmailProcessor', footprintEmailProcessor);
            outerFind.push(...footprintEmailProcessor[0]);
            collectionAttachment.push(...footprintEmailProcessor[1]);
          }
        }

        if (collectionAttachment !== 0) {
          const cleanEmailFootprint = csqAbstractService.cleanEmailDetailsFootprint(
            collectionAttachment
          );
          for (const emailDetail of cleanEmailFootprint) {
            debug('emailDetail', emailDetail);
            const emailSender = new EmailSender(createdDocId, emailDetail);
            await emailSender.send(emailDetail.RECIPIENT);
          }
          const emailDetailLpdsIds = cleanEmailFootprint.flatMap(
            (data) => data.LPDS_ID
          );
          const distinctEmailDetailLpdsid = [...new Set(emailDetailLpdsIds)];

          debug('distinctEmailDetailLpdsid:', distinctEmailDetailLpdsid);
          for (const emailLpdsId of distinctEmailDetailLpdsid) {
            debug('add pending email in email status..');
            firestoreRepository.addLpdsAsPendingEmail(
              emailLpdsId,
              createdDocId
            );
          }
        }
      }

      if (outerFind != undefined) {
        goodServiceQualItems.push(...outerFind);
      }
      debug('goodServiceQualItems:', goodServiceQualItems.length);
      if (goodServiceQualItems.length !== 0) {
        isGoodExists = true;
      }

      // add good items on final result array
      finalServiceQualificationItems.push(...goodServiceQualItems);

      // filter remaining lpds_ids to use in expired and NF processing
      lpdsIdsFromRequest = lpdsIdsFromRequest.filter((data) => {
        const goodLpdsIds = parseGoodServiceQualItems.map(
          (goodItem) => goodItem.lpds_id
        );
        return !goodLpdsIds.includes(data);
      });

      debug('no footprint lpds_ids processing...');
      const parseItemsFornoFootprint = csqData
        .flatMap((data) => {
          return data.serviceQualificationItem.flatMap((item) => {
            return item.service.place.find((place) =>
              lpdsIdsFromRequest.includes(place.id)
            );
          });
        })
        .filter((data) => data != undefined);

      const noFootprintLpdsIds = lpdsIdsFromRequest.filter((data) => {
        const lpdsIds = parseItemsFornoFootprint.map((item) => item.id);
        return !lpdsIds.includes(data);
      });

      debug('noFootprintLpdsIds:', noFootprintLpdsIds);

      // expired lpds processing
      debug('expired item lpds_ids processing...');
      const expiredLpdsIds = lpdsIdsFromRequest.filter((data) => {
        return !noFootprintLpdsIds.includes(data);
      });

      debug('expired lpds_ids:', expiredLpdsIds);

      debug('processing expired and no_footprint items');
      const processors = [];
      if (expiredLpdsIds.length !== 0) {
        isExpiredExists = true;
        processors.push(
          csqExpiredProcessor.processExpiredItems(
            csqRequestBody,
            isInstantSync,
            expiredLpdsIds
          )
        );
      }

      if (noFootprintLpdsIds.length !== 0) {
        processors.push(
          csqNoFootprintProcessor.processNoFootprintItems(
            csqRequestBody,
            isInstantSync,
            noFootprintLpdsIds
          )
        );
      }

      const processedItems = await Promise.all(processors).catch((err) => {
        debug('Error thrown on processing items');
        // TODO: fetch 'err' from ERROR object
        throw new Error(err.message);
      });

      if (processedItems.length !== 0) {
        debug('adding processed items to service qual item list...');

        const processedServiceQualItems = processedItems.flatMap(
          (data) => data.serviceQualificationItem
        );
        finalServiceQualificationItems.push(...processedServiceQualItems);

        isApiDown =
          processedItems.filter((data) => {
            if (data.isApiDown !== undefined) {
              return data.isApiDown;
            }
          }).length !== 0;

        // isExpiredExists =
        //   processedItems.filter((data) => {
        //     if (data.isExpiredExists !== undefined) {
        //       return data.isExpiredExists;
        //     }
        //   }).length !== 0;

        isNoFootprintWithAmsExists =
          processedItems.filter((data) => {
            if (data.isNoFootprintWithAmsExists !== undefined) {
              return data.isNoFootprintWithAmsExists;
            }
          }).length !== 0;

        isNoFootprintWithoutAmsExists =
          processedItems.filter((data) => {
            if (data.isNoFootprintWithoutAmsExists !== undefined) {
              return data.isNoFootprintWithoutAmsExists;
            }
          }).length !== 0;
      }

      debug('isGoodExists:', isGoodExists);
      debug('isExpiredExists:', isExpiredExists);
      debug('isNoFootprintWithAmsExists:', isNoFootprintWithAmsExists);
      debug('isNoFootprintWithoutAmsExists:', isNoFootprintWithoutAmsExists);
      debug('isApiDown:', isApiDown);

      // re-validate State and Response status
      const finalStateAndResponseStatus = csqAbstractService.revalidateStateAndResponseStatus(
        {
          isInstantSync,
          isNoFootprintWithoutAmsExists,
          isNoFootprintWithAmsExists,
          isGoodExists,
          isExpiredExists,
        }
      );

      debug('finalStateAndResponseStatus:', finalStateAndResponseStatus);
      //debug('finalServiceQualificationItems.......', finalServiceQualificationItems)

      // re-compute ids
      finalServiceQualificationItems.forEach((item, index) => {
        item.id = index += 1;
      });

      // payload processing
      const payloadHeaders = {
        id: createdDocId,
        href: `${URL.POST_CHECK_SERVICE_QUAL}/${createdDocId}`,
        checkServiceQualificationDate: moment().format(STANDARD.DATE_FORMAT),
        effectiveQualificationDate: moment().format(STANDARD.DATE_FORMAT),
        state: finalStateAndResponseStatus.state,
      };

      const csqFinalPayload = {
        ...payloadHeaders,
        ...csqRequestBody,
        serviceQualificationItem: [...finalServiceQualificationItems],
      };

      const csqEmptryDocument = firestoreConfig
        .collection(FIRESTORE_ENUM.CSQ_SCHEMA)
        .doc(createdDocId);
      await csqEmptryDocument.set(csqFinalPayload);

      response
        .status(finalStateAndResponseStatus.responseStatus)
        .json(csqFinalPayload);

      // sending email and history_log saving to cloud sql
      // async = return response immediately to client without
      // waiting for this
      (async () => {
        if (processedItems.length !== 0) {
          let emailDetails = processedItems.flatMap(
            (data) => data.emailDetails
          );

          for (const emailDetail of emailDetails) {
            const emailLpdsId = emailDetail.LPDS_ID;
            debug('lpdsid to check for pending email status:', emailLpdsId);
            const emailStatusLpdsDoc = await firestoreRepository.getEmailStatusPendingLpdsIds(
              emailLpdsId
            );
            const isLpdsEmailPending =
              emailStatusLpdsDoc.docs.map((doc) => doc.data()).length !== 0;

            debug('isLpdsEmailPending:', isLpdsEmailPending);
            if (isLpdsEmailPending) {
              emailDetails = csqAbstractService.removeArrayItemByPropValue(
                emailDetails,
                'LPDS_ID',
                emailLpdsId
              );
              debug(
                'pending email status will not send email for lpdsid:',
                emailLpdsId
              );
              debug('updating request doc ids...');
              const updateRequestDocIds = await firestoreRepository.updateReqDocIdsEmailStatusDoc(
                emailStatusLpdsDoc.docs[0].id,
                createdDocId
              );
            } else {
              firestoreRepository.addLpdsAsPendingEmail(emailLpdsId);
              debug('added pending email status to lpdsid:', emailLpdsId);
            }
          }

          if (emailDetails.length !== 0) {
            const cleanEmailDetails = csqAbstractService.cleanEmailDetails(
              emailDetails
            );
            debug(
              'cleanEmailDetails:',
              JSON.stringify(cleanEmailDetails, 0, 2)
            );
            debug('sending emails in progress...');
            for (const emailDetail of cleanEmailDetails) {
              const emailSender = new EmailSender(createdDocId, emailDetail);
              await emailSender.send(emailDetail.RECIPIENT);
            }
          }

          // SHOULD ONLY TRIGGER IF STATUS IS 200
          const historyLogsDetails = processedItems.flatMap(
            (data) => data.historyLogsDetails
          );
          if (
            finalStateAndResponseStatus.responseStatus === 200 &&
            historyLogsDetails.length !== 0
          ) {
            debug('saving data to history log in progress...');

            const collectionForReporting = [];

            for (const historyLogsDetail of historyLogsDetails) {
              const historyLogDataToSave = csqAbstractService.buildItemsForHistoryLog(
                createdDocId,
                historyLogsDetail.parseAmsDetails,
                historyLogsDetail.offers
              );
              collectionForReporting.push(...historyLogDataToSave);
            }

            // debug('collectionForReporting count:', collectionForReporting);
            if (collectionForReporting.length !== 0) {
              const saveToHistoryLogResponse = await dbRepository.addEntryToHistoryLog(
                collectionForReporting
              );
              debug('history log response:', saveToHistoryLogResponse);
            }
          }
        }
      })();
    }
  } catch (err) {
    debug('error catch:', err);
    response.status(400).json({
      status: STATUS.TERMINATED_WITH_ERROR,
      message: err.message,
    });
  } finally {
    firestoreRepository.deleteBlankFirestoreDoc(
      FIRESTORE_ENUM.CSQ_SCHEMA,
      createdDocId
    );
  }

  return response;
};
/**
 * List or find CheckServiceQualification objects
 * This operation list or find CheckServiceQualification entities
 *
 * fields String Comma-separated properties to be provided in response (optional)
 * offset Integer Requested index for start of resources to be provided in response (optional)
 * limit Integer Requested number of resources to be provided in response (optional)
 * returns List
 * */
const listCheckServiceQualification = ({ fields, offset, limit }) =>
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
 * Retrieves a CheckServiceQualification by ID
 * This operation retrieves a CheckServiceQualification entity. Attribute selection is enabled for all first level attributes.
 *
 * id String Identifier of the CheckServiceQualification
 * fields String Comma-separated properties to provide in response (optional)
 * returns CheckServiceQualification
 * */
const retrieveCheckServiceQualification = async (request, response) => {
  try {
    let { doc } = request.params;
    const getRef = firestoreConfig
      .collection(FIRESTORE_ENUM.CSQ_SCHEMA)
      .doc(doc);

    const result = await getRef.get();
    if (!result.exists) {
      debug('Document not found!');
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
  createCheckServiceQualification,
  listCheckServiceQualification,
  retrieveCheckServiceQualification,
};
