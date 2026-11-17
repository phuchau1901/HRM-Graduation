import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordPolicyErrors,passwordPolicyRules} from '../assets/js/password-policy.js';
import {passwordPolicySelect} from '../assets/js/pages/administration/system-settings/system-settings.js';
const policy={minimumLength:8,maximumLength:32,requireUppercase:true,requireLowercase:true,requireDigit:true,requireSpecialCharacter:true,disallowUsernameInPassword:true,passwordHistoryCount:5};
test('password validation follows loaded length and character requirements',()=>{
 assert.deepEqual(passwordPolicyErrors('Abcdef1!','employee',policy),[]);
 assert.ok(passwordPolicyErrors('Abc1!','employee',policy).some(error=>error.includes('8 đến 32')));
 assert.ok(passwordPolicyErrors('Abcdef1!'.repeat(5),'employee',policy).length);
 for(const candidate of ['abcdef1!','ABCDEF1!','Abcdefg!','Abcdef12'])assert.ok(passwordPolicyErrors(candidate,'employee',policy).length);
 assert.ok(passwordPolicyErrors('Employee1!','employee',policy).some(error=>error.includes('tên đăng nhập')));
 assert.ok(passwordPolicyErrors(' '.repeat(12),'employee',policy).length);
 assert.deepEqual(passwordPolicyErrors('simple88','employee',{...policy,requireUppercase:false,requireSpecialCharacter:false,requireDigit:false,requireLowercase:false}),[]);
});
test('policy selects expose requested presets and preserve existing API values',()=>{
 const minimum=passwordPolicySelect('Min','minimumLength',8,[8,10,12,14,16],'ký tự');
 for(const value of [8,10,12,14,16])assert.ok(minimum.includes(`value="${value}"`));
 const maximum=passwordPolicySelect('Max','maximumLength',64,[32,64,128],'ký tự');
 assert.ok(maximum.includes('value="64" selected'));assert.equal((maximum.match(/<option/g)||[]).length,3);
 assert.ok(passwordPolicySelect('Min','minimumLength',20,[8,10,12,14,16],'ký tự').includes('value="20" selected'));
});

test('live requirements retain configuration order, omit disabled flags and track incremental input',()=>{
 const initial=passwordPolicyRules('a','employee',policy);
 assert.deepEqual(initial.map(rule=>rule.key),['length','requireUppercase','requireLowercase','requireDigit','requireSpecialCharacter','username']);
 assert.equal(initial.find(rule=>rule.key==='requireUppercase').passed,false);
 assert.equal(initial.find(rule=>rule.key==='requireLowercase').passed,true);
 assert.ok(passwordPolicyRules('Abcdef1!','employee',policy).every(rule=>rule.passed));
 assert.deepEqual(passwordPolicyRules('abc','employee',{...policy,requireUppercase:false,requireLowercase:false,requireDigit:false,requireSpecialCharacter:false,disallowUsernameInPassword:false}).map(rule=>rule.key),['length']);
});
