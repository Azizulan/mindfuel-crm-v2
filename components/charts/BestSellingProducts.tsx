
import React from 'react';

interface BestSellingProductsProps {
    products: Array<{ name: string, count: number }>;
}

const BestSellingProducts: React.FC<BestSellingProductsProps> = ({ products }) => {
    const maxCount = products.length > 0 ? products[0].count : 1;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 h-full">
            <h3 className="text-lg font-bold text-slate-700 mb-6 uppercase tracking-tighter">Top Performing Inventory</h3>
            {products.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
                    {products.map((product, index) => (
                        <div key={index} className="space-y-2 group">
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-black text-slate-700 truncate max-w-[70%]" title={product.name}>{product.name}</span>
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black text-blue-600">{product.count} UNITS</span>
                            </div>
                            <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className="bg-blue-500 h-full transition-all duration-1000 ease-out group-hover:bg-blue-600" 
                                    style={{ width: `${(product.count / maxCount) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center justify-center h-32 text-slate-500 italic text-sm">
                    <p>No product sales data available.</p>
                </div>
            )}
        </div>
    );
};

export default BestSellingProducts;
