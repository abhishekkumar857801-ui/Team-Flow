import { badRequest } from '../utils/http.js';

// validate({ body: zodSchema, query: zodSchema, params: zodSchema })
export const validate = (schemas) => (req, _res, next) => {
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(badRequest(`Invalid ${key}: ${details.map((d) => `${d.field || key} ${d.message}`).join('; ')}`, details));
    }
    // Express 4 lets us replace these; store parsed (coerced) values.
    if (key === 'query') req.validQuery = result.data;
    else req[key] = result.data;
  }
  next();
};
