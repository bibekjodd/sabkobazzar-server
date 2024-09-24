import { UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';

export const logout = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  req.logOut(() => {
    res.json({ message: 'Logged out successfully' });
  });
});
