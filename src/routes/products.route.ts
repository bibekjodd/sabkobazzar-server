import { createProduct, getProductDetails, queryProducts } from '@/controllers/products.controller';
import { Router } from 'express';

const router = Router();
export const productsRoute = router;

router.route('/').post(createProduct).get(queryProducts);
router.route('/:id').get(getProductDetails);
