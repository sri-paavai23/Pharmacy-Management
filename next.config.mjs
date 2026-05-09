/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ['onnxruntime-node', '@huggingface/transformers', '@xenova/transformers'],
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
                crypto: false,
            };
        }
        
        // Handle .node files
        config.module.rules.push({
            test: /\.node$/,
            use: 'raw-loader',
        });

        return config;
    },
};

export default nextConfig;

