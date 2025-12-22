/**
 * SISTEMA IPFS + BLOCKCHAIN ANCHORING
 * Framework Euystacio - Immutable Artifacts Publication System
 * 
 * Questo sistema gestisce:
 * 1. Upload artifacts su IPFS
 * 2. Pinning permanente (Pinata)
 * 3. Anchoring CID su Ethereum blockchain
 * 4. Verifica integrità crittografica
 */

// ============================================================================
// DEPENDENCIES & CONFIGURATION
// ============================================================================

const { create } = require('ipfs-http-client');
const pinataSDK = require('@pinata/sdk');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configuration
const CONFIG = {
    // IPFS Configuration
    ipfs: {
        host: 'ipfs.infura.io',
        port: 5001,
        protocol: 'https',
        headers: {
            authorization: 'Bearer YOUR_INFURA_PROJECT_ID'
        }
    },
    
    // Pinata Configuration
    pinata: {
        apiKey: process.env.PINATA_API_KEY,
        apiSecret: process.env.PINATA_API_SECRET
    },
    
    // Ethereum Configuration
    ethereum: {
        rpcUrl: process.env.ETH_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
        privateKey: process.env.PRIVATE_KEY,
        anchorContract: '0x_YOUR_ANCHOR_CONTRACT_ADDRESS'
    },
    
    // Framework Artifacts
    artifacts: {
        vetoEtico: './artifacts/veto-etico.md',
        peaceBonds: './artifacts/peace-bonds-terms.md',
        ianiCodebase: './artifacts/iani-codebase.zip',
        genesisBlock: './artifacts/genesis-block.json',
        nreSpecs: './artifacts/nre-specifications.md'
    }
};

// ============================================================================
// IPFS CLIENT INITIALIZATION
// ============================================================================

class IPFSManager {
    constructor(config) {
        this.ipfs = create(config.ipfs);
        this.pinata = new pinataSDK(config.pinata.apiKey, config.pinata.apiSecret);
    }
    
    /**
     * Upload file to IPFS and get CID
     */
    async uploadFile(filePath, metadata = {}) {
        try {
            console.log(`📤 Uploading ${filePath} to IPFS...`);
            
            // Read file
            const fileContent = await fs.readFile(filePath);
            
            // Calculate local hash for verification
            const localHash = crypto.createHash('sha256')
                .update(fileContent)
                .digest('hex');
            
            // Upload to IPFS
            const result = await this.ipfs.add(fileContent, {
                progress: (bytes) => console.log(`  Progress: ${bytes} bytes`)
            });
            
            const cid = result.cid.toString();
            
            console.log(`✅ File uploaded successfully`);
            console.log(`   CID: ${cid}`);
            console.log(`   Local SHA256: ${localHash}`);
            
            return {
                cid,
                path: result.path,
                size: result.size,
                localHash,
                metadata
            };
            
        } catch (error) {
            console.error(`❌ Error uploading file: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Pin CID permanently on Pinata
     */
    async pinToPinata(cid, metadata = {}) {
        try {
            console.log(`📌 Pinning ${cid} to Pinata...`);
            
            const options = {
                pinataMetadata: {
                    name: metadata.name || 'Framework Euystacio Artifact',
                    keyvalues: {
                        framework: 'euystacio',
                        version: metadata.version || '1.0',
                        type: metadata.type || 'document',
                        timestamp: new Date().toISOString()
                    }
                },
                pinataOptions: {
                    cidVersion: 1
                }
            };
            
            const result = await this.pinata.pinByHash(cid, options);
            
            console.log(`✅ Pinned successfully`);
            console.log(`   Status: ${result.status}`);
            console.log(`   Timestamp: ${result.timestamp}`);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Error pinning to Pinata: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Verify file integrity by downloading and comparing hash
     */
    async verifyIntegrity(cid, expectedHash) {
        try {
            console.log(`🔍 Verifying integrity of ${cid}...`);
            
            // Download from IPFS
            const chunks = [];
            for await (const chunk of this.ipfs.cat(cid)) {
                chunks.push(chunk);
            }
            const content = Buffer.concat(chunks);
            
            // Calculate hash
            const downloadedHash = crypto.createHash('sha256')
                .update(content)
                .digest('hex');
            
            const isValid = downloadedHash === expectedHash;
            
            if (isValid) {
                console.log(`✅ Integrity verified - hashes match`);
            } else {
                console.log(`❌ Integrity check failed - hashes don't match`);
                console.log(`   Expected: ${expectedHash}`);
                console.log(`   Got: ${downloadedHash}`);
            }
            
            return isValid;
            
        } catch (error) {
            console.error(`❌ Error verifying integrity: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Get pinning status and metadata
     */
    async getPinStatus(cid) {
        try {
            const filters = {
                hashContains: cid
            };
            
            const result = await this.pinata.pinList(filters);
            
            if (result.rows.length > 0) {
                const pin = result.rows[0];
                return {
                    isPinned: true,
                    status: pin.status,
                    metadata: pin.metadata,
                    dateCreated: pin.date_pinned,
                    size: pin.size
                };
            }
            
            return { isPinned: false };
            
        } catch (error) {
            console.error(`❌ Error checking pin status: ${error.message}`);
            return { isPinned: false, error: error.message };
        }
    }
}

// ============================================================================
// BLOCKCHAIN ANCHOR SYSTEM
// ============================================================================

class BlockchainAnchor {
    constructor(config) {
        this.provider = new ethers.providers.JsonRpcProvider(config.ethereum.rpcUrl);
        this.wallet = new ethers.Wallet(config.ethereum.privateKey, this.provider);
        this.contractAddress = config.ethereum.anchorContract;
        
        // Smart Contract ABI (simplified)
        this.contractABI = [
            "function anchorDocument(string memory name, string memory cid, uint256 timestamp) public returns (uint256)",
            "function getDocument(uint256 id) public view returns (string memory name, string memory cid, uint256 timestamp, address anchor)",
            "function verifyDocument(string memory cid) public view returns (bool exists, uint256 id)",
            "event DocumentAnchored(uint256 indexed id, string name, string cid, uint256 timestamp, address indexed anchor)"
        ];
        
        this.contract = new ethers.Contract(
            this.contractAddress,
            this.contractABI,
            this.wallet
        );
    }
    
    /**
     * Anchor CID on blockchain
     */
    async anchorCID(name, cid, metadata = {}) {
        try {
            console.log(`⚓ Anchoring ${name} to blockchain...`);
            console.log(`   CID: ${cid}`);
            
            const timestamp = Math.floor(Date.now() / 1000);
            
            // Estimate gas
            const gasEstimate = await this.contract.estimateGas.anchorDocument(
                name,
                cid,
                timestamp
            );
            
            console.log(`   Estimated gas: ${gasEstimate.toString()}`);
            
            // Send transaction
            const tx = await this.contract.anchorDocument(
                name,
                cid,
                timestamp,
                {
                    gasLimit: gasEstimate.mul(120).div(100) // +20% buffer
                }
            );
            
            console.log(`   Transaction sent: ${tx.hash}`);
            console.log(`   Waiting for confirmation...`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            console.log(`✅ Document anchored successfully`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
            
            // Parse event to get document ID
            const event = receipt.events.find(e => e.event === 'DocumentAnchored');
            const documentId = event ? event.args.id.toString() : null;
            
            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                documentId,
                timestamp
            };
            
        } catch (error) {
            console.error(`❌ Error anchoring to blockchain: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Verify document exists on blockchain
     */
    async verifyDocument(cid) {
        try {
            console.log(`🔍 Verifying ${cid} on blockchain...`);
            
            const result = await this.contract.verifyDocument(cid);
            
            if (result.exists) {
                console.log(`✅ Document found on blockchain`);
                console.log(`   Document ID: ${result.id.toString()}`);
                
                // Get full document details
                const details = await this.contract.getDocument(result.id);
                
                return {
                    exists: true,
                    id: result.id.toString(),
                    name: details.name,
                    cid: details.cid,
                    timestamp: details.timestamp.toString(),
                    anchoredBy: details.anchor
                };
            } else {
                console.log(`❌ Document not found on blockchain`);
                return { exists: false };
            }
            
        } catch (error) {
            console.error(`❌ Error verifying document: ${error.message}`);
            return { exists: false, error: error.message };
        }
    }
    
    /**
     * Get document by ID
     */
    async getDocumentById(id) {
        try {
            const details = await this.contract.getDocument(id);
            
            return {
                name: details.name,
                cid: details.cid,
                timestamp: details.timestamp.toString(),
                anchoredBy: details.anchor,
                date: new Date(details.timestamp * 1000).toISOString()
            };
            
        } catch (error) {
            console.error(`❌ Error getting document: ${error.message}`);
            throw error;
        }
    }
}

// ============================================================================
// ARTIFACT PUBLICATION WORKFLOW
// ============================================================================

class ArtifactPublisher {
    constructor(config) {
        this.ipfsManager = new IPFSManager(config);
        this.blockchainAnchor = new BlockchainAnchor(config);
        this.config = config;
        this.publishedArtifacts = [];
    }
    
    /**
     * Complete publication workflow for an artifact
     */
    async publishArtifact(name, filePath, metadata = {}) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📦 PUBLISHING ARTIFACT: ${name}`);
        console.log(`${'='.repeat(70)}\n`);
        
        try {
            // Step 1: Upload to IPFS
            const uploadResult = await this.ipfsManager.uploadFile(filePath, metadata);
            
            // Step 2: Pin to Pinata
            await this.ipfsManager.pinToPinata(uploadResult.cid, {
                name,
                ...metadata
            });
            
            // Step 3: Verify integrity
            const isValid = await this.ipfsManager.verifyIntegrity(
                uploadResult.cid,
                uploadResult.localHash
            );
            
            if (!isValid) {
                throw new Error('Integrity verification failed');
            }
            
            // Step 4: Anchor on blockchain
            const anchorResult = await this.blockchainAnchor.anchorCID(
                name,
                uploadResult.cid,
                metadata
            );
            
            // Step 5: Final verification
            const verifyResult = await this.blockchainAnchor.verifyDocument(uploadResult.cid);
            
            // Compile results
            const publication = {
                name,
                cid: uploadResult.cid,
                ipfsUrl: `ipfs://${uploadResult.cid}`,
                gatewayUrls: [
                    `https://ipfs.io/ipfs/${uploadResult.cid}`,
                    `https://gateway.pinata.cloud/ipfs/${uploadResult.cid}`,
                    `https://cloudflare-ipfs.com/ipfs/${uploadResult.cid}`
                ],
                localHash: uploadResult.localHash,
                size: uploadResult.size,
                pinned: true,
                blockchainAnchor: {
                    txHash: anchorResult.txHash,
                    blockNumber: anchorResult.blockNumber,
                    documentId: anchorResult.documentId,
                    timestamp: anchorResult.timestamp
                },
                verified: verifyResult.exists,
                publishedAt: new Date().toISOString()
            };
            
            this.publishedArtifacts.push(publication);
            
            console.log(`\n✅ ARTIFACT PUBLISHED SUCCESSFULLY`);
            console.log(`   CID: ${publication.cid}`);
            console.log(`   Document ID: ${publication.blockchainAnchor.documentId}`);
            console.log(`   TX Hash: ${publication.blockchainAnchor.txHash}`);
            
            return publication;
            
        } catch (error) {
            console.error(`\n❌ PUBLICATION FAILED: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Publish all framework artifacts
     */
    async publishAllArtifacts() {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🚀 PUBLISHING ALL FRAMEWORK ARTIFACTS`);
        console.log(`${'='.repeat(70)}\n`);
        
        const artifacts = [
            {
                name: 'Veto Etico - LOGOS/VE Presentation',
                path: this.config.artifacts.vetoEtico,
                metadata: { type: 'constitution', critical: true }
            },
            {
                name: 'Peace Bonds Terms & Conditions',
                path: this.config.artifacts.peaceBonds,
                metadata: { type: 'financial', critical: true }
            },
            {
                name: 'IANI Open Source Codebase',
                path: this.config.artifacts.ianiCodebase,
                metadata: { type: 'code', critical: true }
            },
            {
                name: 'Genesis Block Data',
                path: this.config.artifacts.genesisBlock,
                metadata: { type: 'genesis', critical: true }
            },
            {
                name: 'NRE Specifications',
                path: this.config.artifacts.nreSpecs,
                metadata: { type: 'specification', critical: true }
            }
        ];
        
        const results = [];
        
        for (const artifact of artifacts) {
            try {
                const result = await this.publishArtifact(
                    artifact.name,
                    artifact.path,
                    artifact.metadata
                );
                results.push(result);
                
                // Wait between publications to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`Failed to publish ${artifact.name}: ${error.message}`);
                results.push({
                    name: artifact.name,
                    error: error.message,
                    failed: true
                });
            }
        }
        
        return results;
    }
    
    /**
     * Generate publication manifest
     */
    generateManifest() {
        const manifest = {
            framework: 'Euystacio',
            version: '1.0',
            publishedAt: new Date().toISOString(),
            totalArtifacts: this.publishedArtifacts.length,
            artifacts: this.publishedArtifacts.map(a => ({
                name: a.name,
                cid: a.cid,
                ipfsUrl: a.ipfsUrl,
                documentId: a.blockchainAnchor.documentId,
                txHash: a.blockchainAnchor.txHash,
                verified: a.verified
            }))
        };
        
        return manifest;
    }
    
    /**
     * Save manifest to file
     */
    async saveManifest(filePath = './publication-manifest.json') {
        const manifest = this.generateManifest();
        await fs.writeFile(filePath, JSON.stringify(manifest, null, 2));
        console.log(`\n📄 Manifest saved to ${filePath}`);
        return manifest;
    }
}

// ============================================================================
// VERIFICATION TOOLS
// ============================================================================

class ArtifactVerifier {
    constructor(config) {
        this.ipfsManager = new IPFSManager(config);
        this.blockchainAnchor = new BlockchainAnchor(config);
    }
    
    /**
     * Complete verification of an artifact
     */
    async verifyArtifact(cid) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🔍 VERIFYING ARTIFACT: ${cid}`);
        console.log(`${'='.repeat(70)}\n`);
        
        const results = {
            cid,
            checks: []
        };
        
        // Check 1: IPFS Availability
        try {
            console.log(`1️⃣ Checking IPFS availability...`);
            const chunks = [];
            for await (const chunk of this.ipfsManager.ipfs.cat(cid)) {
                chunks.push(chunk);
            }
            const content = Buffer.concat(chunks);
            
            results.checks.push({
                name: 'IPFS Availability',
                status: 'PASS',
                message: `File available (${content.length} bytes)`
            });
        } catch (error) {
            results.checks.push({
                name: 'IPFS Availability',
                status: 'FAIL',
                message: error.message
            });
        }
        
        // Check 2: Pinata Pinning Status
        try {
            console.log(`2️⃣ Checking Pinata pinning status...`);
            const pinStatus = await this.ipfsManager.getPinStatus(cid);
            
            if (pinStatus.isPinned) {
                results.checks.push({
                    name: 'Pinata Pinning',
                    status: 'PASS',
                    message: `Pinned since ${pinStatus.dateCreated}`
                });
            } else {
                results.checks.push({
                    name: 'Pinata Pinning',
                    status: 'WARNING',
                    message: 'Not pinned on Pinata'
                });
            }
        } catch (error) {
            results.checks.push({
                name: 'Pinata Pinning',
                status: 'ERROR',
                message: error.message
            });
        }
        
        // Check 3: Blockchain Anchoring
        try {
            console.log(`3️⃣ Checking blockchain anchoring...`);
            const verifyResult = await this.blockchainAnchor.verifyDocument(cid);
            
            if (verifyResult.exists) {
                results.checks.push({
                    name: 'Blockchain Anchoring',
                    status: 'PASS',
                    message: `Anchored as document ID ${verifyResult.id}`,
                    details: verifyResult
                });
            } else {
                results.checks.push({
                    name: 'Blockchain Anchoring',
                    status: 'FAIL',
                    message: 'Not found on blockchain'
                });
            }
        } catch (error) {
            results.checks.push({
                name: 'Blockchain Anchoring',
                status: 'ERROR',
                message: error.message
            });
        }
        
        // Summary
        const passed = results.checks.filter(c => c.status === 'PASS').length;
        const failed = results.checks.filter(c => c.status === 'FAIL').length;
        const warnings = results.checks.filter(c => c.status === 'WARNING').length;
        
        results.summary = {
            total: results.checks.length,
            passed,
            failed,
            warnings,
            overallStatus: failed === 0 ? 'VERIFIED' : 'FAILED'
        };
        
        console.log(`\n📊 VERIFICATION SUMMARY`);
        console.log(`   Total checks: ${results.summary.total}`);
        console.log(`   ✅ Passed: ${passed}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   ⚠️  Warnings: ${warnings}`);
        console.log(`   Overall: ${results.summary.overallStatus}`);
        
        return results;
    }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

async function main() {
    // Initialize publisher
    const publisher = new ArtifactPublisher(CONFIG);
    
    // Example 1: Publish single artifact
    await publisher.publishArtifact(
        'Veto Etico - LOGOS/VE',
        './artifacts/veto-etico.md',
        { type: 'constitution', version: '1.0', critical: true }
    );
    
    // Example 2: Publish all artifacts
    // await publisher.publishAllArtifacts();
    
    // Example 3: Save manifest
    await publisher.saveManifest();
    
    // Example 4: Verify artifact
    const verifier = new ArtifactVerifier(CONFIG);
    await verifier.verifyArtifact('QmYourCIDHere...');
}

// Export classes
module.exports = {
    IPFSManager,
    BlockchainAnchor,
    ArtifactPublisher,
    ArtifactVerifier,
    CONFIG
};

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
