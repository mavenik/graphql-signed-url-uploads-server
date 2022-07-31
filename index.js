require('dotenv').config();
const { ApolloServer, gql } = require('apollo-server');
const aws = require('aws-sdk');

const signS3URL = (req,res,next) => {
}


const typeDefs = gql`
  type Url {
    url: String
  }

  type PresignedPost {
    url: String
    fields: PresignedPostFields
    }

  type PresignedPostFields {
      ContentType: String
      key: String
      bucket: String
      XAmzAlgorithm: String
      XAmzDate: String
      XAmzCredential: String
      Policy: String
      XAmzSignature: String
      XAmzSecurityToken: String
    }


  type Query {
    presignedUploadPost(filename: String, filetype: String): PresignedPost
    getSignedUrl(filename: String): String
  }

  type Mutation {
    deleteObject(filename: String): String
  }
`;

const resolvers = {
  Query: {

    presignedUploadPost: (...args) => {

      const {filename, filetype} = args[1];
      
      const s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
        region: process.env.AWS_BUCKET_REGION
      });

      const params = {
        Expires: 60,
        Bucket: process.env.AWS_BUCKET_NAME,
        Conditions: [["content-length-range", 100, 10000000]], // 100Byte - 10MB
        Fields: {
          "Content-Type": filetype,
          key: 'testSignedUploads-localhost/'+filename,
        }
      };

      var presignedPostData = s3.createPresignedPost(params)

      const hyphenatedFields = [
        'X-Amz-Date',
        'X-Amz-Credential',
        'X-Amz-Algorithm',
        'Content-Type',
        'X-Amz-Signature',
        'X-Amz-Security-Token'
      ];
      hyphenatedFields.forEach((key) => {presignedPostData.fields[key.replace(/-/g, '')] = presignedPostData.fields[key]})

      return presignedPostData;
    },

    getSignedUrl: (...args) => {

      const {filename} = args[1];

      const s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_BUCKET_REGION
      });

      const params = {
        Expires: 60,
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: 'testSignedUploads-localhost/'+filename,
      };

      return s3.getSignedUrl('getObject', params);
    }
  },
  Mutation: {
    deleteObject: (...args) => {
      const {filename} = args[1];
      
      const s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_BUCKET_REGION
      });

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: 'testSignedUploads-localhost/'+filename,
      };

      const deleteS3Object = () => {
        return new Promise((resolve, reject) => {
        s3.deleteObject(params, (err, data) => {
          if(err) reject(err);
          else resolve(data);
        });

        }).then(async (data) => {
          return data;
        }).catch(async (err) => {
          return err;
        });
      }

      return deleteS3Object().then((data) => {
          return "Deleted "+filename+" successfully";
        }
        ).catch((err) => {
        console.log(err, err.stack);
        return "Could not delete "+filename;
        });
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  csrfPrevention: true,
});

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
