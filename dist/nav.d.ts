/**
 * Navigation contributions for HRM feature pack
 */
export declare const navContributions: readonly [{
    readonly id: "hrm";
    readonly label: "HRM";
    readonly path: "/hrm/employees";
    readonly icon: "Users";
    readonly group: "main";
    readonly weight: 50;
    readonly roles: readonly ["admin"];
    readonly showWhen: "authenticated";
    readonly children: readonly [{
        readonly id: "hrm-employees";
        readonly label: "Employees";
        readonly path: "/hrm/employees";
        readonly icon: "IdCard";
        readonly roles: readonly ["admin"];
        readonly showWhen: "authenticated";
    }];
}];
//# sourceMappingURL=nav.d.ts.map