
import React, { useState, useEffect } from 'react';
import { BoxIcon } from './icons/BoxIcon';
import { Product } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';

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
                setName('');
                setPrice('');
                setStock('');
            }
            setError('');
        }
    }, [product, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const priceNum = parseFloat(price);
        const stockNum = parseInt(stock, 10);

        if (!name.trim()) {
            setError('Product name is required.');
            return;
        }
        if (isNaN(priceNum) || priceNum < 0) {
            setError('Please enter a valid positive price.');
            return;
        }
        if (isNaN(stockNum) || stockNum < 0) {
            setError('Please enter a valid positive stock quantity.');
            return;
        }
        setError('');

        const productData = { name, price: priceNum, stock: stockNum };
        if (product) {
            onSave({ ...productData, id: product.id });
        } else {
            onSave(productData);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800">{product ? 'Edit Product' : 'Add New Product'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"><XMarkIcon /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                        <div>
                            <label htmlFor="product-name" className="block text-sm font-medium text-slate-700">Product Name</label>
                            <input type="text" id="product-name" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full input-field" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="product-price" className="block text-sm font-medium text-slate-700">Price (BDT)</label>
                                <input type="number" id="product-price" value={price} onChange={e => setPrice(e.target.value)} className="mt-1 block w-full input-field" min="0" step="any" required />
                            </div>
                            <div>
                                <label htmlFor="product-stock" className="block text-sm font-medium text-slate-700">Stock</label>
                                <input type="number" id="product-stock" value={stock} onChange={e => setStock(e.target.value)} className="mt-1 block w-full input-field" min="0" required />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-t text-right space-x-2">
                        <button type="button" onClick={onClose} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-300 transition-colors text-sm font-medium">Cancel</button>
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">{product ? 'Save Changes' : 'Add Product'}</button>
                    </div>
                </form>
                <style>{`
                    .input-field {
                        display: block;
                        padding: 0.5rem 0.75rem;
                        background-color: white;
                        border: 1px solid #cbd5e1;
                        border-radius: 0.375rem;
                        box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                        font-size: 0.875rem;
                    }
                    .input-field:focus {
                        outline: none;
                        --tw-ring-color: #3b82f6;
                        box-shadow: 0 0 0 1px var(--tw-ring-color);
                        border-color: #3b82f6;
                    }
                 `}</style>
            </div>
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

    const handleOpenAddModal = () => {
        setCurrentProduct(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (product: Product) => {
        setCurrentProduct(product);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentProduct(null);
    };

    const handleSaveProduct = (productData: Product | Omit<Product, 'id'>) => {
        if ('id' in productData) {
            onUpdateProduct(productData as Product);
        } else {
            onAddProduct(productData);
        }
        handleCloseModal();
    };
    
    const handleDelete = (id: string | number) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            onDeleteProduct(id);
        }
    };

    return (
        <div>
            <div className="flex justify-end items-center mb-6 flex-wrap gap-4">
                <button
                    onClick={handleOpenAddModal}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                    <BoxIcon className="h-5 w-5" />
                    Add New Product
                </button>
            </div>
            
            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Product Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Price</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {products.map(product => (
                                <tr key={String(product.id)} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{product.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        {new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(product.price)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{product.stock} units</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                                        <button onClick={() => handleOpenEditModal(product)} className="text-blue-600 hover:text-blue-800">Edit</button>
                                        <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-800">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
             <ProductModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveProduct}
                product={currentProduct}
            />
        </div>
    );
};

export default ProductsPage;
