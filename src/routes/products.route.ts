import {
  addProduct,
  getProductDetails,
  queryProducts,
  setInterested,
  unsetInterested,
  updateProduct
} from '@/controllers/products.controller';
import { Router } from 'express';

const router = Router();
export const productsRoute = router;

router.route('/').post(addProduct).get(queryProducts);
router.route('/:id').get(getProductDetails).put(updateProduct);
router.route('/:id/interested').post(setInterested).delete(unsetInterested);
