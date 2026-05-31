
import React from 'react';

interface BestSellingProductsProps {
    products: Array<{ name: string, count: number }>;
}

const BestSellingProducts: React.FC<BestSellingProductsProps> = ({ products }) => {
    const maxCount = products.length > 0 ? products[0].count : 1;

    return (
        <div className="h-full">
            {products.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-5">
                    {products.map((product, index) => (
                        <div key={index} className="group">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-semibold text-foreground/85 truncate max-w-[70%]" title={product.name}>{product.name}</span>
                                <span className="text-xs font-bold text-blue-600">{product.count}</span>
                            </div>
                            <div className="bg-foreground/[0.08] rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-blue-500 h-full transition-all duration-700 group-hover:bg-blue-600"
                                    style={{ width: `${(product.count / maxCount) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center justify-center h-24 text-foreground/45 text-sm italic">
                    No product sales data available.
                </div>
            )}
        </div>
    );
};

export default BestSellingProducts;
