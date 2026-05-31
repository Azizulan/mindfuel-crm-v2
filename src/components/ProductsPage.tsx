
import React, { useState, useEffect } from 'react';
import { BoxIcon } from './icons/BoxIcon';
import { Product } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { motion, AnimatePresence } from 'motion/react';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (product: Product | Omit<Product, 'id'>) => void;
    product: Product | null;
}

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSave, product }) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [stock, setStock] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (product) {
                setName(product.name);
                setPrice(String(product.price));
                setStock(String(product.stock));
            } else {
                setName(''); setPrice(''); setStock('');
            }
            setError('');
        }
    }, [product, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const priceNum = parseFloat(price);
        const stockNum = parseInt(stock, 10);
        if (!name.trim()) { setError('Product name is required.'); return; }
        if (isNaN(priceNum) || priceNum < 0) { setError('Please enter a valid positive price.'); return; }
        if (isNaN(stockNum) || stockNum < 0) { setError('Please enter a valid positive stock quantity.'); return; }
        setError('');
        const data = { name, price: priceNum, stock: stockNum };
        onSave(product ? { ...data, id: product.id } : data);
    };

    if (!isOpen) return null;

    const inputClass = "w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-2.5 text-sm font-medium text-foreground/90 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all";

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-card rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-foreground/[0.12]"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-foreground/[0.08] flex justify-between items-center">
                    <h3 className="text-base font-bold text-foreground">{product ? 'Edit Product' : 'Add New Product'}</h3>
                    <button onClick={onClose} className="text-foreground/45 hover:text-foreground/70 p-1.5 rounded-lg hover:bg-foreground/[0.08] transition-colors">
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        {error && <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{error}</p>}
                        <div>
                            <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Product Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Premium Subscription" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Price (BDT)</label>
                                <input type="number" value={price} onChange={e => setPrice(e.target.value)} className={inputClass} min="0" step="any" required />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Stock Units</label>
                                <input type="number" value={stock} onChange={e => setStock(e.target.value)} className={inputClass} min="0" required />
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-foreground/[0.04] border-t border-foreground/[0.08] flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="bg-foreground/[0.08] text-foreground/85 px-5 py-2 rounded-xl hover:bg-foreground/[0.12] transition-colors text-sm font-medium">
                            Cancel
                        </button>
                        <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 transition-all text-sm font-medium shadow-sm">
                            {product ? 'Save Changes' : 'Add Product'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

interface ProductsPageProps {
    products: Product[];
    onAddProduct: (product: Omit<Product, 'id'>) => void;
    onUpdateProduct: (product: Product) => void;
    onDeleteProduct: (id: string | number) => void;
}

const ProductsPage: React.FC<ProductsPageProps> = ({ products, onAddProduct, onUpdateProduct, onDeleteProduct }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Product | null>(null);

    const handleOpenAddModal = () => { setCurrentProduct(null); setIsModalOpen(true); };
    const handleOpenEditModal = (p: Product) => { setCurrentProduct(p); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setCurrentProduct(null); };

    const handleSaveProduct = (data: Product | Omit<Product, 'id'>) => {
        if ('id' in data) onUpdateProduct(data as Product);
        else onAddProduct(data);
        handleCloseModal();
    };

    const handleDelete = (id: string | number) => {
        if (window.confirm('Are you sure you want to delete this product?')) onDeleteProduct(id);
    };

    return (
        <div className="space-y-6 pb-12">

            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-foreground/45">{products.length} product{products.length !== 1 ? 's' : ''} in catalog</p>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all text-sm font-semibold shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Product
                </button>
            </div>

            {/* Products grid */}
            {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence>
                        {products.map((product, index) => (
                            <motion.div
                                key={String(product.id)}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.04 }}
                                className="bg-card border border-foreground/[0.12] rounded-2xl shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                        <BoxIcon className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${product.stock > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-foreground leading-snug">{product.name}</h4>
                                    <p className="text-xl font-bold text-blue-600 mt-1">
                                        ৳{product.price.toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex gap-2 pt-1 border-t border-foreground/[0.08]">
                                    <button
                                        onClick={() => handleOpenEditModal(product)}
                                        className="flex-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 py-1.5 rounded-lg transition-colors"
                                    >Edit</button>
                                    <button
                                        onClick={() => handleDelete(product.id)}
                                        className="flex-1 text-xs font-semibold text-red-500 hover:bg-red-50 py-1.5 rounded-lg transition-colors"
                                    >Delete</button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="bg-card border border-dashed border-foreground/[0.15] rounded-2xl p-16 text-center">
                    <BoxIcon className="h-10 w-10 text-foreground/30 mx-auto mb-3" />
                    <p className="text-foreground/45 font-medium text-sm">No products yet. Add your first product to get started.</p>
                    <button onClick={handleOpenAddModal} className="mt-4 text-sm font-semibold text-blue-600 hover:underline">
                        Add a product
                    </button>
                </div>
            )}

            <ProductModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveProduct} product={currentProduct} />
        </div>
    );
};

export default ProductsPage;
