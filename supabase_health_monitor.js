// =====================================================
// Supabase Health Monitor & Connection Tester
// Run this in your browser console to test everything
// =====================================================

class SupabaseHealthMonitor {
    constructor() {
        this.supabase = null;
        this.isConnected = false;
        this.healthCheckInterval = null;
        this.operationLog = [];
        this.maxLogEntries = 100;
    }

    // Initialize the monitor
    async init() {
        console.log('🚀 Initializing Supabase Health Monitor...');
        
        try {
            // Check if Supabase client exists
            if (typeof window !== 'undefined' && window.supabase) {
                this.supabase = window.supabase;
                console.log('✅ Found existing Supabase client');
            } else {
                // Try to import from your project
                console.log('⚠️ No existing Supabase client found, attempting to create one...');
                await this.createSupabaseClient();
            }
            
            await this.testConnection();
            this.startHealthMonitoring();
            
        } catch (error) {
            console.error('❌ Failed to initialize monitor:', error);
        }
    }

    // Create Supabase client if needed
    async createSupabaseClient() {
        try {
            // Check if environment variables are available
            const supabaseUrl = import.meta?.env?.VITE_SUPABASE_URL || 
                               process?.env?.VITE_SUPABASE_URL ||
                               'https://vccijkvrptbtqpaghviq.supabase.co';
            
            const supabaseKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY || 
                               process?.env?.VITE_SUPABASE_ANON_KEY ||
                               'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjY2lqa3ZycHRidHFwYWdodmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMDQxMjUsImV4cCI6MjA3MjY4MDEyNX0.YoSj_YIwSj6ukuFUZgvEvKuio2xgQ3r7_5OqnF45GFw';

            console.log('🔗 Supabase URL:', supabaseUrl);
            console.log('🔑 Supabase Key:', supabaseKey.substring(0, 20) + '...');

            // Try to create client
            const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js');
            this.supabase = createClient(supabaseUrl, supabaseKey);
            
        } catch (error) {
            console.error('❌ Failed to create Supabase client:', error);
            throw error;
        }
    }

    // Test basic connection
    async testConnection() {
        console.log('🔍 Testing Supabase connection...');
        
        try {
            // Test 1: Basic connection
            const { data, error } = await this.supabase.from('job_applications').select('count').limit(1);
            
            if (error) {
                console.error('❌ Database connection failed:', error);
                this.isConnected = false;
                return false;
            }
            
            console.log('✅ Database connection successful');
            this.isConnected = true;
            
            // Test 2: Check tables
            await this.checkTables();
            
            // Test 3: Check storage buckets
            await this.checkStorageBuckets();
            
            return true;
            
        } catch (error) {
            console.error('❌ Connection test failed:', error);
            this.isConnected = false;
            return false;
        }
    }

    // Check database tables
    async checkTables() {
        console.log('📊 Checking database tables...');
        
        const tables = ['job_applications', 'application_documents', 'application_videos'];
        
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
                        console.log(`⚠️ Table '${table}' exists but has issues:`, error.message);
                    }
                } else {
                    console.log(`✅ Table '${table}' exists and accessible`);
                }
            } catch (error) {
                console.log(`❌ Error checking table '${table}':`, error.message);
            }
        }
    }

    // Check storage buckets
    async checkStorageBuckets() {
        console.log('🪣 Checking storage buckets...');
        
        try {
            const { data: buckets, error } = await this.supabase.storage.listBuckets();
            
            if (error) {
                console.error('❌ Failed to list storage buckets:', error);
                return;
            }
            
            if (!buckets || buckets.length === 0) {
                console.log('⚠️ No storage buckets found');
                return;
            }
            
            console.log('📦 Found storage buckets:');
            buckets.forEach(bucket => {
                console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
            });
            
            // Check specific buckets we need
            const requiredBuckets = ['9alwa'];
            for (const bucketName of requiredBuckets) {
                const bucket = buckets.find(b => b.name === bucketName);
                if (bucket) {
                    console.log(`✅ Bucket '${bucketName}' exists`);
                    await this.checkBucketContents(bucketName);
                } else {
                    console.log(`❌ Required bucket '${bucketName}' missing`);
                }
            }
            
        } catch (error) {
            console.error('❌ Storage bucket check failed:', error);
        }
    }

    // Check bucket contents
    async checkBucketContents(bucketName) {
        try {
            const { data: files, error } = await this.supabase.storage
                .from(bucketName)
                .list('', { limit: 10 });
            
            if (error) {
                console.log(`⚠️ Could not list contents of bucket '${bucketName}':`, error.message);
                return;
            }
            
            if (!files || files.length === 0) {
                console.log(`📁 Bucket '${bucketName}' is empty`);
            } else {
                console.log(`📁 Bucket '${bucketName}' contains ${files.length} files/folders`);
                files.slice(0, 5).forEach(file => {
                    console.log(`  - ${file.name} (${file.metadata?.size || 'unknown size'})`);
                });
                if (files.length > 5) {
                    console.log(`  ... and ${files.length - 5} more`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Error checking bucket '${bucketName}' contents:`, error.message);
        }
    }

    // Start continuous health monitoring
    startHealthMonitoring() {
        console.log('🔄 Starting continuous health monitoring...');
        
        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, 30000); // Check every 30 seconds
        
        // Also check immediately
        this.performHealthCheck();
    }

    // Perform health check
    async performHealthCheck() {
        if (!this.isConnected) {
            console.log('⚠️ Connection lost, attempting to reconnect...');
            await this.testConnection();
            return;
        }
        
        try {
            // Quick health check
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
            
        } catch (error) {
            console.log('❌ Health check error:', error.message);
            this.isConnected = false;
        }
    }

    // Test file upload (small test file)
    async testFileUpload() {
        console.log('📤 Testing file upload...');
        
        try {
            // Create a small test file
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
            
            // Clean up test file
            await this.supabase.storage
                .from('9alwa')
                .remove([testPath]);
            
            console.log('🧹 Test file cleaned up');
            return true;
            
        } catch (error) {
            console.error('❌ File upload test error:', error);
            return false;
        }
    }

    // Test database insert
    async testDatabaseInsert() {
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
            
            // Clean up test data
            await this.supabase
                .from('job_applications')
                .delete()
                .eq('email', 'test@example.com');
            
            console.log('🧹 Test data cleaned up');
            return true;
            
        } catch (error) {
            console.error('❌ Database insert test error:', error);
            return false;
        }
    }

    // Run comprehensive tests
    async runAllTests() {
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

    // Stop monitoring
    stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log('🛑 Health monitoring stopped');
        }
    }

    // Get operation log
    getLog() {
        return this.operationLog;
    }

    // Clear log
    clearLog() {
        this.operationLog = [];
        console.log('🗑️ Operation log cleared');
    }
}

// =====================================================
// USAGE INSTRUCTIONS
// =====================================================

console.log(`
🚀 SUPABASE HEALTH MONITOR READY!

Available commands:
- monitor.init()           - Initialize and start monitoring
- monitor.runAllTests()    - Run all tests
- monitor.testConnection() - Test database connection
- monitor.testFileUpload() - Test file upload
- monitor.testDatabaseInsert() - Test database operations
- monitor.checkTables()    - Check database tables
- monitor.checkStorageBuckets() - Check storage buckets
- monitor.stop()           - Stop monitoring
- monitor.getLog()         - Get operation log
- monitor.clearLog()       - Clear operation log

Example usage:
monitor.init().then(() => {
    monitor.runAllTests();
});
`);

// Create global monitor instance
window.monitor = new SupabaseHealthMonitor();

// Auto-initialize if Supabase client exists
if (window.supabase) {
    console.log('🔍 Auto-initializing monitor...');
    window.monitor.init();
}
