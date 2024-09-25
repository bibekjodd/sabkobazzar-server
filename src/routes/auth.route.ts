import { logout } from '@/controllers/auth.controller';
import { Router } from 'express';
import passport from 'passport';

const router = Router();
export const authRoute = router;

router.get(
  '/login/google',
  (req, res, next) => {
    const redirectTo = req.query.redirect;
    // @ts-expect-error ...
    req.session.redirectTo = redirectTo;
    next();
  },
  passport.authenticate('google', { scope: ['email', 'profile'] })
);

router.get('/callback/google', passport.authenticate('google'), (req, res) => {
  // @ts-expect-error ...
  const redirectTo = req.session.redirectTo;
  // @ts-expect-error ...
  delete req.session.redirectTo;
  return res.redirect(redirectTo || '/');
});

router.route('/logout').get(logout).post(logout);
