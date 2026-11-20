/**
 * Routes. HashRouter keeps the app deployable to any static host or
 * sub-folder (e.g. nssoftdev.com/demos/nova-store/) without server rewrites.
 */
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ShopProvider } from './state/ShopContext.jsx';
import ShopLayout from './components/ShopLayout.jsx';
import Toasts from './components/Toasts.jsx';
import Catalog from './pages/Catalog.jsx';
import Product from './pages/Product.jsx';
import Brands from './pages/Brands.jsx';
import Checkout from './pages/Checkout.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import Overview from './pages/admin/Overview.jsx';
import Orders from './pages/admin/Orders.jsx';
import Products from './pages/admin/Products.jsx';
import { Customers, Marketing, Sales, Settings } from './pages/admin/Reports.jsx';

export default function App() {
  return (
    <HashRouter>
      <ShopProvider>
        <Routes>
          <Route element={<ShopLayout />}>
            <Route index element={<Catalog preset="all" />} />
            <Route path="new" element={<Catalog preset="new" />} />
            <Route path="sale" element={<Catalog preset="sale" />} />
            <Route path="favorites" element={<Catalog preset="favorites" />} />
            <Route path="brands" element={<Brands />} />
            <Route path="brand/:brand" element={<Catalog preset="all" />} />
            <Route path="p/:id" element={<Product />} />
            <Route path="checkout" element={<Checkout />} />
          </Route>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="products" element={<Products />} />
            <Route path="customers" element={<Customers />} />
            <Route path="sales" element={<Sales />} />
            <Route path="marketing" element={<Marketing />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toasts />
      </ShopProvider>
    </HashRouter>
  );
}
