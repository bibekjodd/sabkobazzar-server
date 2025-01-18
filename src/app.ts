import 'colors';
import cookieSession from 'cookie-session';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import passport from 'passport';
import { env, validateEnv } from './config/env.config';
import { NotFoundException } from './lib/exceptions';
import { devConsole, sessionOptions } from './lib/utils';
import { handleAsync } from './middlewares/handle-async';
import { handleErrorRequest } from './middlewares/handle-error-request';
import { handleSessionRegenerate } from './middlewares/handle-session-regenerate';
import { openApiSpecs, serveApiReference } from './openapi';
import { GoogleStrategy } from './passport/google.strategy';
import { LocalStrategy } from './passport/local.strategy';
import { serializer } from './passport/serializer';
import { auctionsRoute } from './routes/auctions.route';
import { authRoute } from './routes/auth.route';
import { eventsRoute } from './routes/events.route';
import { feedbacksRoute } from './routes/feedbacks.route';
import { notificationsRoute } from './routes/notifications.route';
import { reportsRoute } from './routes/reports.route';
import { statsRoute } from './routes/stats.route';
import { usersRoute } from './routes/users.route';
import { webhooksRoute } from './routes/webhooks.route';

const app = express();
validateEnv();
app.use('/api/webhooks', express.text({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (env.NODE_ENV === 'development') {
  app.use(morgan('common'));
}
app.use(cors({ origin: env.FRONTEND_URLS, credentials: true }));
app.enable('trust proxy');
app.use(cookieSession(sessionOptions));
app.use(handleSessionRegenerate);
app.use(passport.initialize());
app.use(passport.session());

passport.use('google', GoogleStrategy);
passport.use('local', LocalStrategy);
serializer();

app.get(
  '/',
  handleAsync(async (req, res) => {
    return res.json({
      message: 'Api is running fine...',
      env: env.NODE_ENV,
      date: new Date().toISOString()
    });
  })
);

/* --------- routes --------- */
app.use('/api/auth', authRoute);
app.use('/api/users', usersRoute);
app.use('/api/auctions', auctionsRoute);
app.use('/api/webhooks', webhooksRoute);
app.use('/api/notifications', notificationsRoute);
app.use('/api/events', eventsRoute);
app.use('/api/stats', statsRoute);
app.use('/api/feedbacks', feedbacksRoute);
app.use('/api/reports', reportsRoute);
app.get('/doc', (req, res) => {
  res.json(openApiSpecs);
});
app.use('/reference', serveApiReference);
app.use(() => {
  throw new NotFoundException();
});
app.use(handleErrorRequest);

app.listen(env.PORT, () => {
  devConsole(`⚡[Server]: listening at http://localhost:${env.PORT}`.yellow);
});
export default app;
