import { logout } from '@/controllers/auth.controller';
import { Router } from 'express';
import passport from 'passport';

const router = Router();
export const authRoute = router;

router.get(
  '/login/google',
  (req, res, next) => {
    const redirectUrl = req.query.redirect as string;
    // @ts-expect-error ...
    req.session.redirectTo = redirectUrl;
    next();
  },
  passport.authenticate('google', { scope: ['email', 'profile'] })
);
router.get('/callback/google', passport.authenticate('google'), (req, res) => {
  // @ts-expect-error ...
  const redirectUrl = req.session.redirectTo;

  // @ts-expect-error ...
  delete req.session.redirectTo;
  return res.redirect(redirectUrl || '/');
});

router.route('/logout').get(logout).post(logout);
