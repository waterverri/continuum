// Test the regex pattern
const pattern = /{{([^}]+)}}/;
const testString = "{{a}}";

console.log("Testing regex pattern:", pattern);
console.log("Test string:", testString);

const match = testString.match(pattern);
console.log("Match result:", match);
console.log("Match length:", match ? match.length : 0);
console.log("Full match (match[0]):", match ? match[0] : "undefined");
console.log("Component key (match[1]):", match ? match[1] : "undefined");

// Test with global flag
const globalPattern = /{{([^}]+)}}/g;
console.log("\nTesting with global flag:");
const globalMatch = testString.match(globalPattern);
console.log("Global match result:", globalMatch);

// Test with exec
console.log("\nTesting with exec:");
const execResult = pattern.exec(testString);
console.log("Exec result:", execResult);
console.log("Exec component key:", execResult ? execResult[1] : "undefined");