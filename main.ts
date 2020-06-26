import axios from 'axios'
import process from 'process'
import https from 'https'

const args = process.argv.splice(2)

const key = args[0]
const secret = args[1]
const domain = args[2]
const names = args.splice(3)

const baseURL = 'https://api.godaddy.com'
const head = {
    "Authorization": `sso-key ${key}:${secret}`,
    "Content-Type": "application/json"
}

async function local_ipv6_address(): Promise<string> {
    const instance = axios.create({
        httpsAgent: new https.Agent({  
          rejectUnauthorized: false
        })
      });

    let response = await instance.get("https://[2607:f2d8:4010:8::2]")
    if (typeof response.data === 'string') {
        return response.data
    }
    return null
}

async function current_record_info(name:string, type: string = 'AAAA'): Promise<string> {
    let response = await axios.get(`${baseURL}/v1/domains/${domain}/records/${type}/${name}`, {
        headers: head
    })

    if (Array.isArray(response.data) && typeof response.data[0].data === 'string') {
        return response.data[0].data
    }
    return null
}

async function update_record(name: string, target: string, type: string = 'AAAA', ttl: number = 600) {
    let data = [
        {
            data: target,
            name: name,
            ttl: ttl,
            type: type
        }
    ]
    let str_data = JSON.stringify(data)

    await axios.put(`${baseURL}/v1/domains/${domain}/records/${type}/${name}`, str_data, {
        headers: head
    })
}

const async_sleep = (len: number) => new Promise((res) => setTimeout(res, len))

async function main() {
    while(true) {
        try {
            let flag = false
            let current_info = new Map<string, string>()
            for (let name of names) {
                let current = await current_record_info(name)
                if (current === null) {
                    console.log(`name: ${name}, get current ip address failed!`)
                    flag = true
                    break
                }
                current_info.set(name, current)
            }
            if (flag) {
                await async_sleep(30000)
                continue
            }

            let local = await local_ipv6_address()
            if (local === null) {
                console.log("get local ipv6 address failed!")
                await async_sleep(30000)
                continue
            }

            for(let name of current_info.keys()){
                let current = current_info.get(name)
                if (local !== current) {
                    console.log(`name: ${name} current: ${current} local: ${local} start update domain!`)
                    await update_record(name, local)
                    console.log(`name: ${name} update successfully!`)
                }
            }
            await async_sleep(30000)
        }
        catch(e) {
            console.log(`catch error: ${e}`)
            await async_sleep(30000)
        }
    }
}

main()