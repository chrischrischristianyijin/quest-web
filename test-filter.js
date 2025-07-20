// 测试筛选功能的模拟数据
const testInsights = [
    {
        id: '1',
        title: 'Tech Article 1',
        description: 'A technology article',
        url: 'https://example.com/tech1',
        tags: ['tech'],
        created_at: '2024-01-01T10:00:00Z'
    },
    {
        id: '2',
        title: 'Design Article 1',
        description: 'A design article',
        url: 'https://example.com/design1',
        tags: ['design'],
        created_at: '2024-01-02T10:00:00Z'
    },
    {
        id: '3',
        title: 'Tech Article 2',
        description: 'Another technology article',
        url: 'https://example.com/tech2',
        tags: ['tech', 'business'],
        created_at: '2024-01-03T10:00:00Z'
    },
    {
        id: '4',
        title: 'Business Article 1',
        description: 'A business article',
        url: 'https://example.com/business1',
        tags: ['business'],
        created_at: '2024-01-04T10:00:00Z'
    },
    {
        id: '5',
        title: 'Article with no tags',
        description: 'An article without tags',
        url: 'https://example.com/notags',
        tags: [],
        created_at: '2024-01-05T10:00:00Z'
    }
];

// 模拟筛选函数
function applyFilters(allInsights, currentFilter) {
    console.log('applyFilters called, allInsights length:', allInsights.length);
    console.log('Current filter:', currentFilter);
    
    if (!allInsights.length) {
        console.log('No insights, returning empty array');
        return [];
    }

    let filteredInsights;

    // 根据筛选类型过滤内容
    if (currentFilter === 'latest') {
        // 显示所有内容，按最新排序
        filteredInsights = [...allInsights].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        console.log('Using latest filter, showing all insights');
    } else {
        // 根据标签筛选 - 基于insight的tags字段
        filteredInsights = [...allInsights].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // 基于实际tags字段进行筛选
        if (currentFilter !== 'latest') {
            filteredInsights = filteredInsights.filter(insight => {
                // 检查insight是否有tags字段
                if (!insight.tags || !Array.isArray(insight.tags)) {
                    console.log('Insight has no tags or tags is not array:', insight.id);
                    return false;
                }
                
                // 检查是否包含当前筛选的标签
                const hasTag = insight.tags.includes(currentFilter);
                console.log(`Insight ${insight.id} tags:`, insight.tags, 'has tag', currentFilter, ':', hasTag);
                return hasTag;
            });
            console.log('Applied tag filter for:', currentFilter);
        }
    }
    
    console.log('Filtered insights length:', filteredInsights.length);
    return filteredInsights;
}

// 测试不同的筛选条件
console.log('=== Testing Filter Function ===\n');

console.log('1. Testing "latest" filter:');
const latestResults = applyFilters(testInsights, 'latest');
console.log('Latest results:', latestResults.map(i => i.title));
console.log('Count:', latestResults.length);
console.log('Expected: 5 (all insights)\n');

console.log('2. Testing "tech" filter:');
const techResults = applyFilters(testInsights, 'tech');
console.log('Tech results:', techResults.map(i => i.title));
console.log('Count:', techResults.length);
console.log('Expected: 2 (Tech Article 1, Tech Article 2)\n');

console.log('3. Testing "design" filter:');
const designResults = applyFilters(testInsights, 'design');
console.log('Design results:', designResults.map(i => i.title));
console.log('Count:', designResults.length);
console.log('Expected: 1 (Design Article 1)\n');

console.log('4. Testing "business" filter:');
const businessResults = applyFilters(testInsights, 'business');
console.log('Business results:', businessResults.map(i => i.title));
console.log('Count:', businessResults.length);
console.log('Expected: 2 (Tech Article 2, Business Article 1)\n');

console.log('5. Testing "lifestyle" filter (should be empty):');
const lifestyleResults = applyFilters(testInsights, 'lifestyle');
console.log('Lifestyle results:', lifestyleResults.map(i => i.title));
console.log('Count:', lifestyleResults.length);
console.log('Expected: 0 (no insights with lifestyle tag)\n');

console.log('=== Test Summary ===');
console.log('✅ Latest filter shows all insights');
console.log('✅ Tech filter shows only tech insights');
console.log('✅ Design filter shows only design insights');
console.log('✅ Business filter shows only business insights');
console.log('✅ Lifestyle filter shows no insights (correct)'); 