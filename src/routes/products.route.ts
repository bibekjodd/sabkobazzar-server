import {
  addProduct,
  getProductDetails,
  queryProducts,
  updateProduct
} from '@/controllers/products.controller';
import { Router } from 'express';

const router = Router();
export const productsRoute = router;

router.route('/').post(addProduct).get(queryProducts);
router.route('/:id').get(getProductDetails).put(updateProduct);
