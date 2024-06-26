import { AdminService } from '@app/services/admin.service';
import { expect } from 'chai';

describe('AdminService', () => {
    let adminService: AdminService;
    beforeEach(() => {
        adminService = new AdminService();
    });

    it('should return correct password message if the correct password is provided', () => {
        const password = 'log2990-312';
        const result = adminService.checkPassword(password);
        expect(result).to.equal(true);
    });

    it('should return incorrect password message if an incorrect password is provided', () => {
        const password = 'incorrect-password';
        const result = adminService.checkPassword(password);
        expect(result).to.equal(false);
    });
});
