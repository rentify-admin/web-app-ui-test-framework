import BaseApi from "./base-api";

class RoleApi extends BaseApi {

    constructor(client) {
        super(client, '/roles')
    }

    getOrCreateByName(name) {
        return this.getByName(name).then(role => {
            if (!role) {
                return this.create({
                    name,
                    description: `Role used by Auto tests, don't change!`,
                    scope: "external",
                    level: 2
                }).then(roleData => roleData.data);
            }
            return role;
        })
    }

}

export default RoleApi;