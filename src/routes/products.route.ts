import { createProduct, queryProducts } from '@/controllers/products.controller';
import { Router } from 'express';

const router = Router();
export const productsRoute = router;

router.route('/').post(createProduct).get(queryProducts);
