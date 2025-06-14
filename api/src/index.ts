import {HttpFunction} from '@google-cloud/functions-framework';

/**
 * An HTTP-triggered Cloud Function.
 *
 * @param {object} req Express-style request object.
 * @param {object} res Express-style response object.
 */
export const continuumApi: HttpFunction = (req, res) => {
  res.send('Continuum API Function is running!');
};
