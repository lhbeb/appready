// =====================================================
// Supabase Health Monitor - TypeScript Version
// Auto-runs when imported (development only)
// =====================================================

import { supabase } from './supabase';

export class SupabaseHealthMonitor {
    private supabase: any;
    private isConnected: boolean = false;
    private healthCheckInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Only initialize in development mode
        if (import.meta.env.DEV) {
            this.init();
        } else {
            console.log('🔇 Supabase Health Monitor disabled in production');
        }
    }

    private async init() {
        console.log('🚀 Initializing Supabase Health Monitor...');
        
        try {
            // Use imported Supabase client directly
            this.supabase = supabase;
            
            await this.testConnection();
            this.startHealthMonitoring();
            
        } catch (error) {
            console.error('❌ Failed to initialize monitor:', error);
        }
    }

    async testConnection(): Promise<boolean> {
        console.log('🔍 Testing Supabase connection...');
        
        try {
            const { data, error } = await this.supabase.from('job_applications').select('count').limit(1);
            
            if (error) {
                console.error('❌ Database connection failed:', error);
                this.isConnected = false;
                return false;
            }
            
            console.log('✅ Database connection successful');
            this.isConnected = true;
            
            await this.checkTables();
            await this.checkStorageBuckets();
            
            return true;
            
        } catch (error) {
            console.error('❌ Connection test failed:', error);
            this.isConnected = false;
            return false;
        }
    }

    private async checkTables(): Promise<void> {
        console.log('📊 Checking database tables...');
        
        const tables = ['job_applications'];
        
        for (const table of tables) {
            try {
                const { data, error } = await this.supabase
                    .from(table)
                    .select('*')
                    .limit(1);
                
                if (error) {
                    if (error.code === '42P01') {
                        console.log(`❌ Table '${table}' does not exist`);
                    } else {
                        console.log(`⚠️ Table '${table}' exists but has issues: ${error.message}`);
                    }
                } else {
                    console.log(`✅ Table '${table}' exists and accessible`);
                }
            } catch (error: any) {
                console.log(`❌ Error checking table '${table}': ${error.message}`);
            }
        }
    }

    private async checkStorageBuckets(): Promise<void> {
        console.log('🪣 Checking storage buckets...');
        
        try {
            const { data: buckets, error } = await this.supabase.storage.listBuckets();
            
            if (error) {
                console.log('⚠️ Failed to list storage buckets:', error.message);
                // Try alternative method - test direct bucket access
                await this.testDirectBucketAccess();
                return;
            }
            
            if (!buckets || buckets.length === 0) {
                console.log('⚠️ No storage buckets returned from listBuckets()');
                // Try alternative method - test direct bucket access
                await this.testDirectBucketAccess();
                return;
            }
            
            console.log('📦 Found storage buckets:');
            buckets.forEach((bucket: any) => {
                console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
            });
            
            // Check specific buckets we need
            const requiredBuckets = ['9alwa'];
            for (const bucketName of requiredBuckets) {
                const bucket = buckets.find((b: any) => b.name === bucketName);
                if (bucket) {
                    console.log(`✅ Required bucket "${bucketName}" exists`);
                    await this.checkBucketContents(bucketName);
                } else {
                    console.log(`❌ Required bucket "${bucketName}" missing`);
                }
            }
            
        } catch (error: any) {
            console.error('❌ Storage bucket check failed:', error);
            // Try alternative method - test direct bucket access
            await this.testDirectBucketAccess();
        }
    }

    private async testDirectBucketAccess(): Promise<void> {
        console.log('🔍 Testing direct bucket access for 9alwa...');
        
        try {
            // Try to list contents of 9alwa bucket directly
            const { data: files, error } = await this.supabase.storage
                .from('9alwa')
                .list('', { limit: 1 });
            
            if (error) {
                if (error.message.includes('not found') || error.message.includes('does not exist')) {
                    console.log('❌ Bucket 9alwa does not exist');
                } else {
                    console.log('⚠️ Bucket 9alwa exists but has access restrictions:', error.message);
                }
            } else {
                console.log('✅ Bucket 9alwa exists and is accessible!');
                if (files && files.length > 0) {
                    console.log(`📁 Bucket contains ${files.length} items`);
                } else {
                    console.log('📁 Bucket is empty');
                }
            }
        } catch (error: any) {
            console.log('❌ Direct bucket access test failed:', error.message);
        }
    }

    private async checkBucketContents(bucketName: string): Promise<void> {
        try {
            const { data: files, error } = await this.supabase.storage
                .from(bucketName)
                .list('', { limit: 10 });
            
            if (error) {
                console.log(`⚠️ Could not list contents of bucket '${bucketName}': ${error.message}`);
                return;
            }
            
            if (!files || files.length === 0) {
                console.log(`📁 Bucket '${bucketName}' is empty`);
            } else {
                console.log(`📁 Bucket '${bucketName}' contains ${files.length} files/folders`);
                files.slice(0, 5).forEach((file: any) => {
                    console.log(`  - ${file.name} (${file.metadata?.size || 'unknown size'})`);
                });
                if (files.length > 5) {
                    console.log(`  ... and ${files.length - 5} more`);
                }
            }
            
        } catch (error: any) {
            console.log(`❌ Error checking bucket '${bucketName}' contents: ${error.message}`);
        }
    }

    private startHealthMonitoring(): void {
        console.log('🔄 Starting continuous health monitoring...');
        
        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, 30000);
        
        this.performHealthCheck();
    }

    private async performHealthCheck(): Promise<void> {
        if (!this.isConnected) {
            console.log('⚠️ Connection lost, attempting to reconnect...');
            await this.testConnection();
            return;
        }
        
        try {
            const { data, error } = await this.supabase
                .from('job_applications')
                .select('count')
                .limit(1);
            
            if (error) {
                console.log('⚠️ Health check failed:', error.message);
                this.isConnected = false;
            } else {
                console.log('💚 Health check passed - Database responsive');
            }
            
        } catch (error: any) {
            console.log('❌ Health check error:', error.message);
            this.isConnected = false;
        }
    }

    async testFileUpload(): Promise<boolean> {
        console.log('📤 Testing file upload...');
        
        try {
            const testContent = `Test file created at ${new Date().toISOString()}`;
            const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });
            
            const testPath = `test_${Date.now()}/test.txt`;
            
            const { data, error } = await this.supabase.storage
                .from('9alwa')
                .upload(testPath, testFile);
            
            if (error) {
                console.error('❌ File upload test failed:', error);
                return false;
            }
            
            console.log('✅ File upload test successful:', data.path);
            
            await this.supabase.storage.from('9alwa').remove([testPath]);
            console.log('🧹 Test file cleaned up');
            return true;
            
        } catch (error: any) {
            console.error('❌ File upload test error:', error);
            return false;
        }
    }

    async testDatabaseInsert(): Promise<boolean> {
        console.log('💾 Testing database insert...');
        
        try {
            const testData = {
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com',
                address: '123 Test St',
                city: 'Test City',
                state: 'Arizona',
                phone_number: '5551234567',
                ssn: '123456789'
            };
            
            const { data, error } = await this.supabase
                .from('job_applications')
                .insert(testData)
                .select();
            
            if (error) {
                console.error('❌ Database insert test failed:', error);
                return false;
            }
            
            console.log('✅ Database insert test successful:', data[0].id);
            
            await this.supabase
                .from('job_applications')
                .delete()
                .eq('email', 'test@example.com');
            
            console.log('🧹 Test data cleaned up');
            return true;
            
        } catch (error: any) {
            console.error('❌ Database insert test error:', error);
            return false;
        }
    }

    async runAllTests(): Promise<any> {
        console.log('🧪 Running comprehensive tests...');
        
        const results = {
            connection: await this.testConnection(),
            fileUpload: await this.testFileUpload(),
            databaseInsert: await this.testDatabaseInsert()
        };
        
        console.log('📊 Test Results:', results);
        
        const passedTests = Object.values(results).filter(Boolean).length;
        const totalTests = Object.keys(results).length;
        
        console.log(`🎯 Tests passed: ${passedTests}/${totalTests}`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All tests passed! Your Supabase setup is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Check the console for details.');
        }
        
        return results;
    }

    stop(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log('🛑 Health monitoring stopped');
        }
    }

    // Public methods for manual testing (these call the private methods)
    async checkTablesPublic(): Promise<void> {
        console.log('📊 Checking database tables (public method)...');
        await this.checkTables();
    }

    async checkStorageBucketsPublic(): Promise<void> {
        console.log('🪣 Checking storage buckets (public method)...');
        await this.checkStorageBuckets();
    }

    // Get current connection status
    getConnectionStatus(): boolean {
        return this.isConnected;
    }

    // Manual connection test
    async testConnectionPublic(): Promise<boolean> {
        console.log('🔍 Testing Supabase connection (public method)...');
        return await this.testConnection();
    }
}

// Extend Window interface to include supabase
declare global {
    interface Window {
        supabase: any;
        monitor: SupabaseHealthMonitor;
    }
}

// Initialize monitor in development mode
let monitor: SupabaseHealthMonitor | null = null;

if (import.meta.env.DEV) {
    // Create global monitor instance
    monitor = new SupabaseHealthMonitor();
    window.monitor = monitor;

    console.log(`
🚀 SUPABASE HEALTH MONITOR AUTO-LOADED!

Available commands:
- monitor.runAllTests()           - Run all tests
- monitor.testConnectionPublic()  - Test database connection
- monitor.testFileUpload()        - Test file upload
- monitor.testDatabaseInsert()    - Test database operations
- monitor.checkTablesPublic()     - Check database tables
- monitor.checkStorageBucketsPublic() - Check storage buckets
- monitor.getConnectionStatus()   - Get current connection status
- monitor.stop()                  - Stop monitoring

Example usage:
monitor.runAllTests()

Note: Now configured to use '9alwa' storage bucket
`);
}

export default monitor;
